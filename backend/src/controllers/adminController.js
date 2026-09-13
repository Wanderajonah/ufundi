const { isConfigured } = require("../config/supabase");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const FundiProfile = require("../models/FundiProfile");
const Job = require("../models/Job");
const Booking = require("../models/Booking");
const Review = require("../models/Review");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const PlatformSettings = require("../models/PlatformSettings");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email, role: "admin" });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalFundis,
      totalJobs,
      pendingJobs,
      activeBookings,
      completedBookings,
      disputedBookings,
      totalReviews,
      totalTransactions,
      revenueResult,
      pendingVerifications,
      verifiedFundis,
    ] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "fundi" }),
      Job.countDocuments(),
      Job.countDocuments({ status: "open" }),
      Booking.countDocuments({ status: { $in: ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS"] } }),
      Booking.countDocuments({ status: "COMPLETED" }),
      Booking.countDocuments({ status: "DISPUTED" }),
      Review.countDocuments(),
      Transaction.countDocuments(),
      Transaction.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      FundiProfile.countDocuments({ verificationStatus: "pending" }),
      FundiProfile.countDocuments({ verificationStatus: "verified" }),
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    const recentUsers = await User.find({ role: { $ne: "admin" } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email role createdAt profilePhoto");

    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("clientId", "name")
      .populate("fundiId", "name")
      .select("category description status agreedPrice proposedPrice createdAt");

    return res.json({
      totalUsers,
      totalFundis,
      totalJobs,
      pendingJobs,
      activeBookings,
      completedBookings,
      disputedBookings,
      totalReviews,
      totalTransactions,
      totalRevenue,
      pendingVerifications,
      verifiedFundis,
      recentUsers,
      recentBookings: recentBookings.map((b) => ({
        id: b._id,
        service: b.category ? b.category.charAt(0).toUpperCase() + b.category.slice(1) : b.description,
        category: b.category,
        description: b.description,
        client: b.clientId,
        fundi: b.fundiId,
        amount: b.agreedPrice || b.proposedPrice || 0,
        status: b.status,
        createdAt: b.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query = { role: "customer" };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select("-password");

    const total = await User.countDocuments(query);

    return res.json({
      users,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let fundiProfile = null;
    if (user.role === "fundi") {
      fundiProfile = await FundiProfile.findOne({ userId: user._id });
    }

    const bookingCount = await Booking.countDocuments({
      $or: [{ clientId: user._id }, { fundiId: user._id }],
    });

    const transactionCount = await Transaction.countDocuments({ userId: user._id });

    return res.json({ user, fundiProfile, bookingCount, transactionCount });
  } catch (error) {
    return next(error);
  }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'active' or 'suspended'" });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    return next(error);
  }
};

const getFundis = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query = { role: "fundi" };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .select("-password");

    const total = await User.countDocuments(query);

    let fundiProfiles = await FundiProfile.find({
      userId: { $in: users.map((u) => u._id) },
    });

    if (status) {
      fundiProfiles = fundiProfiles.filter((p) => p.verificationStatus === status);
    }

    const profileMap = {};
    fundiProfiles.forEach((p) => {
      profileMap[p.userId.toString()] = p;
    });

    const fundis = users
      .filter((user) => !status || profileMap[user._id.toString()])
      .map((user) => ({
        ...user.toObject(),
        fundiProfile: profileMap[user._id.toString()] || null,
      }));

    return res.json({
      fundis,
      total: status ? fundis.length : total,
      page: Number(page),
      totalPages: Math.ceil((status ? fundis.length : total) / limit),
    });
  } catch (error) {
    return next(error);
  }
};

const verifyFundi = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!["pending", "verified", "rejected", "unverified"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const update = {
      verificationStatus: status,
      verified: status === "verified",
      reviewedAt: new Date(),
      ...(notes !== undefined && { verificationNotes: notes }),
    };

    const profile = await FundiProfile.findOneAndUpdate(
      { userId: id },
      update,
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ message: "Fundi profile not found" });
    }

    const AdminNotification = require("../models/AdminNotification");
    const fundi = await User.findById(id);
    const fundiName = fundi ? fundi.name : "A fundi";
    const notificationMessage = status === "verified"
      ? `${fundiName} has been verified.`
      : `${fundiName} verification was rejected.${notes ? ` Reason: ${notes}` : ""}`;
    await AdminNotification.create({
      type: status === "verified" ? "verification_approved" : "verification_rejected",
      message: notificationMessage,
      relatedId: id,
    });

    const { notifyFundi } = require("../services/notificationService");
    const event = status === "verified" ? "verification_approved" : "verification_rejected";
    await notifyFundi(id, event, { notes });

    return res.json({ fundiProfile: profile });
  } catch (error) {
    return next(error);
  }
};

const getJobs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status: jobStatus } = req.query;
    const query = {};
    if (jobStatus) query.status = jobStatus;

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("customerId", "name email phone")
      .populate("fundiId", "name email phone");

    const total = await Job.countDocuments(query);

    return res.json({
      jobs,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
};

const getBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status: bookingStatus } = req.query;
    const query = {};
    if (bookingStatus) query.status = bookingStatus;

    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("clientId", "name email phone")
      .populate("fundiId", "name email phone");

    const total = await Booking.countDocuments(query);

    return res.json({
      bookings,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
};

const getDisputes = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const bookings = await Booking.find({ status: "DISPUTED" })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("clientId", "name email phone")
      .populate("fundiId", "name email phone");

    const total = await Booking.countDocuments({ status: "DISPUTED" });

    return res.json({
      disputes: bookings,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
};

const resolveDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    if (!resolution || !["refund_client", "release_fundi", "cancelled"].includes(resolution)) {
      return res.status(400).json({
        message: "Resolution must be 'refund_client', 'release_fundi', or 'cancelled'",
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.paymentStatus === "held") {
      const { refundPayment, releasePayment } = require("./walletController");
      const mockRes = { json: () => {}, status: () => ({ json: () => {} }) };

      if (resolution === "refund_client") {
        await refundPayment(
          { body: { bookingId: id }, user: { _id: booking.clientId } },
          mockRes,
          (err) => { if (err) throw err; }
        );
      } else if (resolution === "release_fundi") {
        await releasePayment(
          { body: { bookingId: id }, user: { _id: booking.clientId } },
          mockRes,
          (err) => { if (err) throw err; }
        );
      }
    }

    booking.disputeReason = null;
    if (resolution === "cancelled") {
      booking.status = "CANCELLED";
    } else {
      booking.status = "COMPLETED";
    }
    await booking.save();

    return res.json({ booking });
  } catch (error) {
    return next(error);
  }
};

const getReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const reviews = await Review.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("fundiId", "name")
      .populate("customerId", "name");

    const total = await Review.countDocuments();

    return res.json({
      reviews,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return next(error);
  }
};

const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("userId", "name email");

    const total = await Transaction.countDocuments();

    const revenueAgg = await Transaction.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    return res.json({
      transactions,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      totalRevenue: revenueAgg.length > 0 ? revenueAgg[0].total : 0,
    });
  } catch (error) {
    return next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);

    const [monthlyGrowth, serviceDistribution, bookingStatusDist, avgRating, jobCompletion, weeklyJobs, weeklyRevenue] =
      await Promise.all([
        User.aggregate([
          { $match: { role: { $ne: "admin" }, createdAt: { $gte: sixMonthsAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
              users: { $sum: { $cond: [{ $eq: ["$role", "customer"] }, 1, 0] } },
              fundis: { $sum: { $cond: [{ $eq: ["$role", "fundi"] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Job.aggregate([
          { $group: { _id: "$category", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Booking.aggregate([
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Review.aggregate([
          { $group: { _id: null, avg: { $avg: "$rating" }, total: { $sum: 1 } } },
        ]),
        Booking.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              completed: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] } },
              cancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
              disputed: { $sum: { $cond: [{ $eq: ["$status", "DISPUTED"] }, 1, 0] } },
            },
          },
        ]),
        Booking.aggregate([
          { $match: { createdAt: { $gte: sevenDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Transaction.aggregate([
          { $match: { status: "completed", createdAt: { $gte: sevenDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              amount: { $sum: "$amount" },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyMap = {};
    weeklyJobs.forEach((d) => { weeklyMap[d._id] = d.count; });
    const revenueMap = {};
    weeklyRevenue.forEach((d) => { revenueMap[d._id] = d.amount; });

    const weeklyData = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const key = d.toISOString().split("T")[0];
      weeklyData.push({
        name: dayNames[d.getDay()],
        jobs: weeklyMap[key] || 0,
        revenue: revenueMap[key] || 0,
      });
    }

    const serviceDist = serviceDistribution.map((s) => ({
      name: s._id,
      count: s.count,
    }));

    const bookingStatuses = bookingStatusDist.reduce(
      (acc, s) => {
        acc[s._id] = s.count;
        return acc;
      },
      {},
    );

    const completionRate =
      jobCompletion.length > 0 && jobCompletion[0].total > 0
        ? Math.round((jobCompletion[0].completed / jobCompletion[0].total) * 100)
        : 0;

    const avgRatingVal = avgRating.length > 0 ? avgRating[0].avg : 0;
    const totalReviews = avgRating.length > 0 ? avgRating[0].total : 0;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const growthMap = {};
    monthlyGrowth.forEach((m) => {
      growthMap[m._id] = { users: m.users, fundis: m.fundis };
    });

    const growthData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = monthNames[d.getMonth()];
      const entry = growthMap[key] || { users: 0, fundis: 0 };
      growthData.push({
        month: monthLabel,
        users: entry.users,
        fundis: entry.fundis,
      });
    }

    return res.json({
      weeklyData,
      growthData,
      serviceDistribution: serviceDist,
      bookingStatuses,
      avgRating: avgRatingVal,
      totalReviews,
      completionRate,
    });
  } catch (error) {
    return next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User with this email already exists" });
    }
    const user = await User.create({ name, email, phone, password, role });
    if (role === "fundi") {
      await FundiProfile.create({ userId: user._id });
    }
    return res.status(201).json({ message: "User created successfully", user });
  } catch (error) {
    return next(error);
  }
};

const getHealth = async (req, res) => {
  const dbConfigured = isConfigured();
  return res.json({
    status: dbConfigured ? "healthy" : "degraded",
    api: "running",
    database: dbConfigured ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
};

const getSettings = async (req, res, next) => {
  try {
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = await PlatformSettings.create({});
    }
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = new PlatformSettings();
    }
    Object.assign(settings, req.body);
    await settings.save();
    return res.json(settings);
  } catch (error) {
    return next(error);
  }
};

const deleteFundi = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Fundi not found" });
    }
    await FundiProfile.findOneAndDelete({ userId: user._id });
    return res.json({ message: "Fundi deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === "admin") {
      return res.status(400).json({ message: "Admin accounts cannot be deleted" });
    }
    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    await User.findByIdAndDelete(id);
    await FundiProfile.findOneAndDelete({ userId: id });
    if (typeof Wallet.findOneAndDelete === "function") {
      await Wallet.findOneAndDelete({ userId: id }).catch(() => {});
    }

    return res.json({ message: "User deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

const updateBookingStatusAdmin = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["PENDING", "ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DISPUTED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${validStatuses.join(", ")}` });
    }
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate("clientId", "name email phone")
      .populate("fundiId", "name email phone");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    return res.json({ booking });
  } catch (error) {
    return next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const notifications = await AdminNotification.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await AdminNotification.countDocuments();
    const unread = await AdminNotification.countDocuments({ read: false });
    return res.json({ notifications, total, unread, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await AdminNotification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    return res.json({ notification });
  } catch (error) {
    return next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    await AdminNotification.updateMany({ read: false }, { read: true });
    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    return next(error);
  }
};

const deleteReviewAdmin = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    return res.json({ message: "Review deleted successfully" });
  } catch (error) {
    return next(error);
  }
};

const getPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("userId", "name email");

    const total = await Transaction.countDocuments();

    const revenueAgg = await Transaction.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    return res.json({
      payments: transactions,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      totalRevenue,
    });
  } catch (error) {
    return next(error);
  }
};

const releaseEscrow = async (req, res, next) => {
  try {
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.paymentStatus !== "held") {
      return res.status(400).json({ message: "Escrow is not currently held" });
    }

    booking.paymentStatus = "released";
    booking.escrowReleasedAt = new Date();
    await booking.save();

    await Transaction.create({
      walletId: booking.clientId,
      userId: booking.fundiId,
      type: "escrow_release",
      amount: booking.agreedPrice || booking.proposedPrice || 0,
      status: "completed",
      relatedBooking: booking._id,
      description: "Escrow released by admin",
    });

    return res.json({ message: "Escrow released successfully", booking });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  login,
  getStats,
  getUsers,
  getUserById,
  updateUserStatus,
  getFundis,
  verifyFundi,
  deleteFundi,
  deleteUser,
  getJobs,
  getBookings,
  updateBookingStatusAdmin,
  getDisputes,
  resolveDispute,
  getReviews,
  deleteReviewAdmin,
  getTransactions,
  getPayments,
  releaseEscrow,
  getAnalytics,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getHealth,
  getSettings,
  updateSettings,
  createUser,
};
