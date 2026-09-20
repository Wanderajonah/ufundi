const express = require("express");
const {
  getProfile,
  updateProfile,
  updateLocation,
  uploadProfilePicture,
  uploadCoverPhoto,
  uploadPortfolioImages,
  deletePortfolioImage,
  requestVerification,
  enableFundi,
  registerPushToken,
} = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");
const { uploadProfile, uploadPortfolio, uploadVerification } = require("../middleware/uploadMiddleware");
const {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} = require("../controllers/notificationController");
const Referee = require("../models/Referee");

const router = express.Router();

// Referee CRUD
router.get("/referees", protect, async (req, res, next) => {
  try {
    const referees = await Referee.find({ userId: req.user._id });
    return res.json(referees);
  } catch (error) {
    return next(error);
  }
});

router.post("/referees", protect, async (req, res, next) => {
  try {
    const count = await Referee.countDocuments({ userId: req.user._id });
    if (count >= 5) {
      return res.status(400).json({ message: "Maximum 5 referees allowed" });
    }
    const { name, relationship, phoneNumber, email } = req.body;
    if (!name || !relationship || !phoneNumber) {
      return res.status(400).json({ message: "Name, relationship, and phone number are required" });
    }
    const referee = await Referee.create({
      userId: req.user._id,
      name,
      relationship,
      phoneNumber,
      email: email || "",
    });
    return res.status(201).json(referee);
  } catch (error) {
    return next(error);
  }
});

router.delete("/referees/:id", protect, async (req, res, next) => {
  try {
    const referee = await Referee.findById(req.params.id);
    if (!referee) {
      return res.status(404).json({ message: "Referee not found" });
    }
    if (String(referee.userId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    await referee.delete();
    return res.json({ message: "Referee removed" });
  } catch (error) {
    return next(error);
  }
});

router.get("/notifications", protect, getNotifications);
router.get("/notifications/unread-count", protect, getUnreadCount);
router.patch("/notifications/:id/read", protect, markRead);
router.patch("/notifications/read-all", protect, markAllRead);

router.get("/profile", protect, getProfile);
router.put("/update", protect, updateProfile);
router.put("/location", protect, updateLocation);
router.post("/enable-fundi", protect, enableFundi);
router.post("/push-token", protect, registerPushToken);
router.post(
  "/profile-picture",
  protect,
  uploadProfile.single("profilePicture"),
  uploadProfilePicture,
);
router.post(
  "/cover-picture",
  protect,
  uploadProfile.single("coverPicture"),
  uploadCoverPhoto,
);
router.post(
  "/portfolio/upload",
  protect,
  uploadPortfolio.array("images", 10),
  uploadPortfolioImages,
);
router.delete(
  "/portfolio/image",
  protect,
  deletePortfolioImage,
);
router.post(
  "/verification-request",
  protect,
  uploadVerification.array("documents", 5),
  requestVerification,
);

module.exports = router;
