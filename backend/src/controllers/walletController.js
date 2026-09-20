const crypto = require("crypto");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const Booking = require("../models/Booking");
const PlatformSettings = require("../models/PlatformSettings");
const { normalizePhone: normalizeUgandaPhone } = require("../services/otpService");

const generateRef = (prefix) =>
  `${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId, balance: 0, currency: "UGX" });
  }
  return wallet;
};

const getWallet = async (req, res, next) => {
  try {
    const wallet = await getOrCreateWallet(req.user._id);
    return res.json({ success: true, wallet });
  } catch (error) {
    return next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const filter = { userId: req.user._id };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("relatedBooking", "category status agreedPrice")
      .populate("relatedUser", "name");

    const total = await Transaction.countDocuments(filter);

    return res.json({
      success: true,
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      total,
    });
  } catch (error) {
    return next(error);
  }
};

const deposit = async (req, res, next) => {
  try {
    const { amount, paymentMethod = "mobile_money", phone } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const wallet = await getOrCreateWallet(req.user._id);

    if (wallet.status === "frozen") {
      return res.status(403).json({ success: false, message: "Wallet is frozen" });
    }

    const reference = generateRef("DEP");

    const transaction = await Transaction.create({
      walletId: wallet._id,
      userId: req.user._id,
      type: "deposit",
      amount,
      currency: wallet.currency,
      reference,
      description: `Deposit of ${wallet.currency} ${amount.toLocaleString()}`,
      status: "completed",
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance + amount,
      paymentMethod,
      metadata: { phone },
    });

    wallet.balance += amount;
    await wallet.save();

    return res.json({
      success: true,
      transaction,
      balance: wallet.balance,
    });
  } catch (error) {
    return next(error);
  }
};

const withdraw = async (req, res, next) => {
  try {
    const { amount, paymentMethod = "mobile_money", phone } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const wallet = await getOrCreateWallet(req.user._id);

    if (wallet.status === "frozen") {
      return res.status(403).json({ success: false, message: "Wallet is frozen" });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }

    const reference = generateRef("WTH");

    const transaction = await Transaction.create({
      walletId: wallet._id,
      userId: req.user._id,
      type: "withdrawal",
      amount,
      currency: wallet.currency,
      reference,
      description: `Withdrawal of ${wallet.currency} ${amount.toLocaleString()}`,
      status: "completed",
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance - amount,
      paymentMethod,
      metadata: { phone },
    });

    wallet.balance -= amount;
    await wallet.save();

    return res.json({
      success: true,
      transaction,
      balance: wallet.balance,
    });
  } catch (error) {
    return next(error);
  }
};

const payBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not your booking" });
    }

    if (booking.status !== "COMPLETED") {
      return res.status(400).json({ success: false, message: "Booking not yet completed" });
    }

    if (!booking.agreedPrice || !booking.priceAgreed) {
      return res.status(400).json({ success: false, message: "No agreed price set" });
    }

    const amount = booking.agreedPrice;

    const wallet = await getOrCreateWallet(req.user._id);

    if (wallet.status === "frozen") {
      return res.status(403).json({ success: false, message: "Wallet is frozen" });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Need UGX ${amount.toLocaleString()}`,
      });
    }

    const fundiWallet = await getOrCreateWallet(booking.fundiId);

    const platformFee = await getPlatformFee(amount);
    const fundiPayout = amount - platformFee;

    const reference = generateRef("PAY");

    const clientTransaction = await Transaction.create({
      walletId: wallet._id,
      userId: req.user._id,
      type: "payment",
      amount,
      currency: wallet.currency,
      reference,
      description: `Payment for booking #${bookingId}`,
      status: "completed",
      relatedBooking: bookingId,
      relatedUser: booking.fundiId,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance - amount,
      paymentMethod: "wallet",
    });

    const fundiTransaction = await Transaction.create({
      walletId: fundiWallet._id,
      userId: booking.fundiId,
      type: "payment_received",
      amount: fundiPayout,
      currency: fundiWallet.currency,
      reference: generateRef("REC"),
      description: `Payment received for booking #${bookingId}`,
      status: "completed",
      relatedBooking: bookingId,
      relatedUser: req.user._id,
      balanceBefore: fundiWallet.balance,
      balanceAfter: fundiWallet.balance + fundiPayout,
    });

    if (platformFee > 0) {
      await Transaction.create({
        walletId: wallet._id,
        userId: req.user._id,
        type: "platform_fee",
        amount: platformFee,
        currency: wallet.currency,
        reference: generateRef("FEE"),
        description: `Platform fee for booking #${bookingId}`,
        status: "completed",
        relatedBooking: bookingId,
        relatedUser: booking.fundiId,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance - amount,
        metadata: { fundiPayout, platformFee },
      });
    }

    wallet.balance -= amount;
    fundiWallet.balance += fundiPayout;

    await Promise.all([wallet.save(), fundiWallet.save()]);

    return res.json({
      success: true,
      transaction: clientTransaction,
      balance: wallet.balance,
      message: `Payment successful. UGX ${fundiPayout.toLocaleString()} sent to fundi, UGX ${platformFee.toLocaleString()} platform fee.`,
    });
  } catch (error) {
    return next(error);
  }
};

const transfer = async (req, res, next) => {
  try {
    const { amount, recipientPhone } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    if (!recipientPhone) {
      return res.status(400).json({ success: false, message: "Recipient phone required" });
    }

    const User = require("../models/User");
    const recipient = await User.findOne({ phone: normalizeUgandaPhone(recipientPhone) });
    if (!recipient) {
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }

    if (recipient._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot transfer to yourself" });
    }

    const wallet = await getOrCreateWallet(req.user._id);

    if (wallet.status === "frozen") {
      return res.status(403).json({ success: false, message: "Wallet is frozen" });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }

    const recipientWallet = await getOrCreateWallet(recipient._id);

    const reference = generateRef("TRF");

    const senderTx = await Transaction.create({
      walletId: wallet._id,
      userId: req.user._id,
      type: "transfer_out",
      amount,
      currency: wallet.currency,
      reference,
      description: `Transfer to ${recipient.name || recipientPhone}`,
      status: "completed",
      relatedUser: recipient._id,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance - amount,
    });

    const recipientTx = await Transaction.create({
      walletId: recipientWallet._id,
      userId: recipient._id,
      type: "transfer_in",
      amount,
      currency: recipientWallet.currency,
      reference: generateRef("TRF"),
      description: `Transfer from ${req.user.name || req.user.phone}`,
      status: "completed",
      relatedUser: req.user._id,
      balanceBefore: recipientWallet.balance,
      balanceAfter: recipientWallet.balance + amount,
    });

    wallet.balance -= amount;
    recipientWallet.balance += amount;

    await Promise.all([wallet.save(), recipientWallet.save()]);

    return res.json({
      success: true,
      transaction: senderTx,
      balance: wallet.balance,
      message: "Transfer successful",
    });
  } catch (error) {
    return next(error);
  }
};

const getPlatformFee = async (amount) => {
  // Fundis receive the FULL amount agreed with the client. The platform's
  // only revenue is the client-side fee, so no commission is deducted here.
  return 0;
};

const getClientFee = async (amount) => {
  try {
    const settings = await PlatformSettings.findOne();
    const rate = settings?.clientFeeRate != null ? settings.clientFeeRate : 5;
    return Math.round(amount * (rate / 100));
  } catch {
    return Math.round(amount * 0.05);
  }
};

const holdPayment = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not your booking" });
    }

    if (booking.status !== "ACCEPTED") {
      return res.status(400).json({ success: false, message: "Booking must be accepted before payment" });
    }

    if (!booking.priceAgreed || !booking.agreedPrice) {
      return res.status(400).json({ success: false, message: "No agreed price set" });
    }

    if (booking.paymentStatus !== "unpaid") {
      return res.status(400).json({ success: false, message: `Payment already ${booking.paymentStatus}` });
    }
    const amount = booking.agreedPrice;
    const clientFee = await getClientFee(amount);
    const escrowTotal = amount + clientFee;

    const wallet = await getOrCreateWallet(req.user._id);

    if (wallet.status === "frozen") {
      return res.status(403).json({ success: false, message: "Wallet is frozen" });
    }

    if (wallet.balance < escrowTotal) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Need UGX ${escrowTotal.toLocaleString()}. Please deposit first.`,
      });
    }

    const reference = generateRef("ESC");

    const transaction = await Transaction.create({
      walletId: wallet._id,
      userId: req.user._id,
      type: "escrow_hold",
      amount: escrowTotal,
      currency: wallet.currency,
      reference,
      description: `Escrow hold for booking #${bookingId}`,
      status: "completed",
      relatedBooking: bookingId,
      relatedUser: booking.fundiId,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance - escrowTotal,
      metadata: { heldBalanceBefore: wallet.heldBalance, heldBalanceAfter: wallet.heldBalance + escrowTotal, clientFee },
    });

    wallet.balance -= escrowTotal;
    wallet.heldBalance += escrowTotal;
    await wallet.save();

    booking.paymentStatus = "held";
    booking.escrowHeldAt = new Date();
    booking.escrowAmount = escrowTotal;
    booking.clientFee = clientFee;
    await booking.save();

    return res.json({
      success: true,
      transaction,
      balance: wallet.balance,
      heldBalance: wallet.heldBalance,
      message: `Payment held in escrow. UGX ${escrowTotal.toLocaleString()} held (incl. UGX ${clientFee.toLocaleString()} platform fee).`,
    });
  } catch (error) {
    return next(error);
  }
};

const releaseEscrow = async (bookingId) => {
  if (!bookingId) {
    throw Object.assign(new Error("Booking ID required"), { statusCode: 400 });
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw Object.assign(new Error("Booking not found"), { statusCode: 404 });
  }

  if (booking.paymentStatus !== "held") {
    throw Object.assign(new Error("No escrow funds to release"), { statusCode: 400 });
  }

  const amount = booking.agreedPrice;
  const escrowTotal = booking.escrowAmount || amount;
  const clientFee = booking.clientFee ?? 0;

  const platformFee = await getPlatformFee(amount);
  const fundiPayout = amount - platformFee;
  const platformRevenue = clientFee + platformFee;

  const clientWallet = await getOrCreateWallet(booking.clientId);
  const fundiWallet = await getOrCreateWallet(booking.fundiId);

  if (clientWallet.heldBalance < escrowTotal) {
    throw Object.assign(new Error("Insufficient held balance"), { statusCode: 400 });
  }

  // Release to fundi
  const releaseRef = generateRef("REL");
  await Transaction.create({
    walletId: clientWallet._id,
    userId: booking.clientId,
    type: "escrow_release",
    amount: escrowTotal,
    currency: clientWallet.currency,
    reference: releaseRef,
    description: `Escrow released for booking #${bookingId}`,
    status: "completed",
    relatedBooking: bookingId,
    relatedUser: booking.fundiId,
    balanceBefore: clientWallet.balance,
    balanceAfter: clientWallet.balance,
    metadata: {
      heldBalanceBefore: clientWallet.heldBalance,
      heldBalanceAfter: clientWallet.heldBalance - escrowTotal,
      fundiPayout,
      platformFee,
      clientFee,
      platformRevenue,
    },
  });

  // Payment received by fundi
  const receiveRef = generateRef("REC");
  await Transaction.create({
    walletId: fundiWallet._id,
    userId: booking.fundiId,
    type: "payment_received",
    amount: fundiPayout,
    currency: fundiWallet.currency,
    reference: receiveRef,
    description: `Payment received for booking #${bookingId}`,
    status: "completed",
    relatedBooking: bookingId,
    relatedUser: booking.clientId,
    balanceBefore: fundiWallet.balance,
    balanceAfter: fundiWallet.balance + fundiPayout,
    metadata: { platformFee },
  });

  // Platform fee transaction
  if (platformRevenue > 0) {
    const feeRef = generateRef("FEE");
    await Transaction.create({
      walletId: clientWallet._id,
      userId: booking.clientId,
      type: "platform_fee",
      amount: platformRevenue,
      currency: clientWallet.currency,
      reference: feeRef,
      description: `Platform fee for booking #${bookingId}`,
      status: "completed",
      relatedBooking: bookingId,
      balanceBefore: clientWallet.balance,
      balanceAfter: clientWallet.balance,
      metadata: {
        heldBalanceBefore: clientWallet.heldBalance,
        heldBalanceAfter: clientWallet.heldBalance - escrowTotal,
        clientFee,
        commission: platformFee,
      },
    });
  }

  clientWallet.heldBalance -= escrowTotal;
  fundiWallet.balance += fundiPayout;

  await Promise.all([clientWallet.save(), fundiWallet.save()]);

  booking.paymentStatus = "released";
  booking.escrowReleasedAt = new Date();
  await booking.save();

  return {
    success: true,
    fundiPayout,
    platformRevenue,
    message: `Payment released to fundi. UGX ${fundiPayout.toLocaleString()} sent, UGX ${platformRevenue.toLocaleString()} platform fee.`,
  };
};

const refundEscrow = async (bookingId) => {
  if (!bookingId) {
    throw Object.assign(new Error("Booking ID required"), { statusCode: 400 });
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw Object.assign(new Error("Booking not found"), { statusCode: 404 });
  }

  if (booking.paymentStatus !== "held") {
    throw Object.assign(new Error("No escrow funds to refund"), { statusCode: 400 });
  }

  const amount = booking.agreedPrice;
  // The client fee was included in the escrow hold, so the FULL held amount
  // must be returned to the client on refund.
  const escrowTotal = booking.escrowAmount || amount + (booking.clientFee ?? 0);
  const clientWallet = await getOrCreateWallet(booking.clientId);

  if (clientWallet.heldBalance < escrowTotal) {
    throw Object.assign(new Error("Insufficient held balance"), { statusCode: 400 });
  }

  const reference = generateRef("RFD");

  await Transaction.create({
    walletId: clientWallet._id,
    userId: booking.clientId,
    type: "escrow_refund",
    amount: escrowTotal,
    currency: clientWallet.currency,
    reference,
    description: `Escrow refund for booking #${bookingId}`,
    status: "completed",
    relatedBooking: bookingId,
    relatedUser: booking.fundiId,
    balanceBefore: clientWallet.balance,
    balanceAfter: clientWallet.balance + escrowTotal,
    metadata: {
      heldBalanceBefore: clientWallet.heldBalance,
      heldBalanceAfter: clientWallet.heldBalance - escrowTotal,
      clientFee: booking.clientFee ?? 0,
    },
  });

  clientWallet.heldBalance -= escrowTotal;
  clientWallet.balance += escrowTotal;
  await clientWallet.save();

  booking.paymentStatus = "refunded";
  await booking.save();

  return {
    success: true,
    balance: clientWallet.balance,
    heldBalance: clientWallet.heldBalance,
    message: "Escrow funds refunded to your wallet",
  };
};

const releasePayment = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not your booking" });
    }

    const result = await releaseEscrow(bookingId);
    return res.json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

const refundPayment = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not your booking" });
    }

    const result = await refundEscrow(bookingId);
    return res.json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    return next(error);
  }
};

module.exports = {
  getWallet,
  getTransactions,
  deposit,
  withdraw,
  payBooking,
  transfer,
  getOrCreateWallet,
  holdPayment,
  releasePayment,
  refundPayment,
  releaseEscrow,
  refundEscrow,
  getPlatformFee,
};
