const express = require("express");
const {
  login,
  getHealth,
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
  getSettings,
  updateSettings,
  createUser,
} = require("../controllers/adminController");
const { protect, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", login);
router.get("/health", getHealth);

router.use(protect, requireRole("admin"));

router.get("/stats", getStats);
router.get("/users", getUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/status", updateUserStatus);
router.get("/fundis", getFundis);
router.patch("/fundis/:id/verify", verifyFundi);
router.delete("/fundis/:id", deleteFundi);
router.delete("/users/:id", deleteUser);
router.get("/jobs", getJobs);
router.get("/bookings", getBookings);
router.patch("/bookings/:id/status", updateBookingStatusAdmin);
router.get("/disputes", getDisputes);
router.patch("/disputes/:id/resolve", resolveDispute);
router.get("/reviews", getReviews);
router.delete("/reviews/:id", deleteReviewAdmin);
router.get("/transactions", getTransactions);
router.get("/payments", getPayments);
router.patch("/payments/:id/release", releaseEscrow);
router.get("/analytics", getAnalytics);
router.get("/notifications", getNotifications);
router.patch("/notifications/read-all", markAllNotificationsRead);
router.patch("/notifications/:id/read", markNotificationRead);
router.post("/users", createUser);
router.post("/seed", async (req, res, next) => {
  try {
    const seedData = require("../utils/seed-data");
    await seedData();
    res.json({ message: "Database seeded successfully" });
  } catch (error) {
    next(error);
  }
});
router.get("/settings", getSettings);
router.put("/settings", updateSettings);

module.exports = router;
