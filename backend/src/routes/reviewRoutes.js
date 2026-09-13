const express = require("express");
const {
  createReview,
  updateReview,
  getReviewsByFundi,
  getMyReviews
} = require("../controllers/reviewController");
const { protect } = require("../middleware/authMiddleware");
const { uploadReview } = require("../middleware/uploadMiddleware");
const { storageFileUrl } = require("../services/gridfsStorage");

const router = express.Router();

router.post("/", protect, createReview);
router.get("/mine", protect, getMyReviews);
router.patch("/:id", protect, updateReview);
router.get("/:fundiId", getReviewsByFundi);

// Upload a photo to attach to a review. Stores the file in GridFS and returns
// a server URL the client passes to createReview/updateReview in photoUrls.
router.post("/upload", protect, uploadReview.array("images", 3), async (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ success: false, message: "No image files provided" });
    }
    const urls = req.files.map((f) => storageFileUrl("reviews", f.filename));
    return res.json({ success: true, urls });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
