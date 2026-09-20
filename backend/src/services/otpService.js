const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Otp = require("../models/Otp");
const { sendSms, normalizePhone } = require("./egoSms");

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

// Dev mode is strictly opt-in via COMMS_DEV_MODE=true so codes are never
// logged (or returned to the client) by accident in production.
const isDevMode = () => process.env.COMMS_DEV_MODE === "true";

const generateCode = () => String(Math.floor(1000 + Math.random() * 9000));

/** Uganda mobile: 2567XXXXXXXX */
const assertUgandaPhone = (phone) => {
  let n = normalizePhone(phone);
  if (n.startsWith("0")) n = `256${n.slice(1)}`;
  if (/^7\d{8}$/.test(n)) n = `256${n}`;
  if (!/^2567\d{8}$/.test(n)) {
    const err = new Error("Invalid Uganda phone. Use 07XX XXX XXX or 2567XXXXXXXX");
    err.statusCode = 400;
    throw err;
  }
  return n;
};

const issueOtp = async (phone, purpose) => {
  const normalized = assertUgandaPhone(phone);
  const existing = await Otp.findOne({ phone: normalized, purpose });

  if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - new Date(existing.lastSentAt).getTime())) / 1000
    );
    const err = new Error(`Please wait ${waitSec}s before requesting another code`);
    err.statusCode = 429;
    throw err;
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await Otp.findOneAndUpdate(
    { phone: normalized, purpose },
    { codeHash, expiresAt, attempts: 0, lastSentAt: new Date() },
    { upsert: true, new: true }
  );

  const message = `Your Ufundi code is ${code}. Valid for 10 minutes. Do not share this code.`;

  if (isDevMode()) {
    console.log(`[Ufundi DEV OTP] ${normalized} (${purpose}): ${code}`);
  } else {
    await sendSms({ toNumber: normalized, message });
  }

  const response = {
    message: "OTP sent successfully",
    phone: normalized,
    expiresIn: Math.floor(OTP_TTL_MS / 1000)
  };

  if (isDevMode()) {
    response.devCode = code;
  }

  return response;
};

const verifyOtp = async (phone, code, purpose) => {
  const normalized = assertUgandaPhone(phone);
  const normalizedCode = String(code || "").trim();
  if (!/^\d{4}$/.test(normalizedCode)) {
    const err = new Error("Enter the 4-digit verification code");
    err.statusCode = 400;
    throw err;
  }
  const record = await Otp.findOne({ phone: normalized, purpose });

  if (!record) {
    const err = new Error("No OTP found. Request a new code.");
    err.statusCode = 400;
    throw err;
  }

  if (record.expiresAt < new Date()) {
    await Otp.deleteOne({ _id: record._id });
    const err = new Error("OTP expired. Request a new code.");
    err.statusCode = 400;
    throw err;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    const err = new Error("Too many failed attempts. Request a new code.");
    err.statusCode = 429;
    throw err;
  }

  const valid = await bcrypt.compare(normalizedCode, record.codeHash);
  if (!valid) {
    record.attempts += 1;
    await record.save();
    const err = new Error("Invalid verification code");
    err.statusCode = 400;
    throw err;
  }

  await Otp.deleteOne({ _id: record._id });
  return normalized;
};

module.exports = { issueOtp, verifyOtp, normalizePhone: assertUgandaPhone };
