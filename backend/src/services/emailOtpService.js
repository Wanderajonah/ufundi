const bcrypt = require("bcryptjs");
const EmailOtp = require("../models/EmailOtp");

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const isDevMode = () => process.env.COMMS_DEV_MODE === "true";

const normalizeEmail = (email) => {
  const normalized = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    const error = new Error("Enter a valid email address");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

const generateCode = () => String(Math.floor(100000 + Math.random() * 900000));

const sendEmail = async ({ to, code }) => {
  if (isDevMode()) {
    console.log(`[Ufundi DEV EMAIL OTP] ${to}: ${code}`);
    return;
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_OTP_FROM) {
    const error = new Error("Email login is not configured. Set RESEND_API_KEY and EMAIL_OTP_FROM.");
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_OTP_FROM,
      to: [to],
      subject: "Your Ufundi sign-in code",
      text: `Your Ufundi sign-in code is ${code}. It expires in 10 minutes. Do not share this code.`,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Could not send email code${detail ? `: ${detail}` : ""}`);
    error.statusCode = 502;
    throw error;
  }
};

const issueEmailOtp = async (email) => {
  const normalized = normalizeEmail(email);
  const existing = await EmailOtp.findOne({ email: normalized, purpose: "login" });
  if (existing && Date.now() - new Date(existing.lastSentAt).getTime() < RESEND_COOLDOWN_MS) {
    const error = new Error("Please wait before requesting another code");
    error.statusCode = 429;
    throw error;
  }

  const code = generateCode();
  const record = await EmailOtp.findOneAndUpdate(
    { email: normalized, purpose: "login" },
    { codeHash: await bcrypt.hash(code, 10), expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0, lastSentAt: new Date() },
    { upsert: true, new: true },
  );
  try {
    await sendEmail({ to: normalized, code });
  } catch (error) {
    // Do not leave a cooldown record behind when delivery itself failed.
    await EmailOtp.deleteOne({ _id: record._id });
    throw error;
  }

  const result = { message: "Email code sent", email: normalized, expiresIn: OTP_TTL_MS / 1000 };
  if (isDevMode()) result.devCode = code;
  return result;
};

const verifyEmailOtp = async (email, code) => {
  const normalized = normalizeEmail(email);
  const record = await EmailOtp.findOne({ email: normalized, purpose: "login" });
  if (!record) {
    const error = new Error("No code found. Request a new code.");
    error.statusCode = 400;
    throw error;
  }
  if (record.expiresAt < new Date()) {
    await EmailOtp.deleteOne({ _id: record._id });
    const error = new Error("Code expired. Request a new code.");
    error.statusCode = 400;
    throw error;
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    const error = new Error("Too many failed attempts. Request a new code.");
    error.statusCode = 429;
    throw error;
  }
  if (!/^\d{6}$/.test(String(code || "")) || !(await bcrypt.compare(String(code), record.codeHash))) {
    record.attempts += 1;
    await record.save();
    const error = new Error("Invalid verification code");
    error.statusCode = 400;
    throw error;
  }
  await EmailOtp.deleteOne({ _id: record._id });
  return normalized;
};

module.exports = { issueEmailOtp, verifyEmailOtp, normalizeEmail };
