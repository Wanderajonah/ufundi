const express = require("express");
const router = express.Router();
const path = require("path");
const { protect, requireRole, requireVerifiedFundi } = require("../middleware/authMiddleware");
const { uploadBooking } = require("../middleware/uploadMiddleware");
const { storageFileUrl } = require("../services/gridfsStorage");
const Booking = require("../models/Booking");
const {
  createBooking,
  acceptBooking,
  declineBooking,
  updateBookingStatus,
  completeBooking,
  cancelBooking,
  getUserBookings,
  getBookingById,
  updateFundiLocation,
  negotiatePrice
} = require("../services/bookingService");

// Client routes
router.post("/client/create", protect, requireRole("customer"), async (req, res) => {
  try {
    const booking = await createBooking(req.user._id, req.body);
    res.status(201).json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/client/bookings", protect, requireRole("customer"), async (req, res) => {
  try {
    const { status } = req.query;
    const bookings = await getUserBookings(req.user._id, "customer", status);
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/client/bookings/:id", protect, requireRole("customer"), async (req, res) => {
  try {
    const booking = await getBookingById(req.params.id, req.user._id, "customer");
    res.json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/client/bookings/:id/complete", protect, requireRole("customer"), async (req, res) => {
  try {
    const booking = await completeBooking(req.params.id, req.user._id);
    res.json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/client/bookings/:id/cancel", protect, requireRole("customer"), async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await cancelBooking(req.params.id, req.user._id, "customer", reason);
    res.json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/client/bookings/:id/price", protect, requireRole("customer"), async (req, res) => {
  try {
    const { price, action } = req.body;
    const booking = await negotiatePrice(req.params.id, req.user._id, "customer", { price, action });
    res.json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Fundi routes
router.post("/fundi/accept", protect, requireRole("fundi"), requireVerifiedFundi, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await acceptBooking(bookingId, req.user._id);
    res.json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/fundi/decline", protect, requireRole("fundi"), requireVerifiedFundi, async (req, res) => {
  try {
    const { bookingId } = req.body;
    const booking = await declineBooking(bookingId, req.user._id);
    res.json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put("/fundi/status", protect, requireRole("fundi"), requireVerifiedFundi, async (req, res) => {
  try {
    const { bookingId, status } = req.body;
    const booking = await updateBookingStatus(bookingId, req.user._id, status);
    res.json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/fundi/cancel", protect, requireRole("fundi"), requireVerifiedFundi, async (req, res) => {
  try {
    const { bookingId, reason } = req.body;
    const booking = await cancelBooking(bookingId, req.user._id, "fundi", reason);
    res.json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/fundi/bookings", protect, requireRole("fundi"), requireVerifiedFundi, async (req, res) => {
  try {
    const { status } = req.query;
    const bookings = await getUserBookings(req.user._id, "fundi", status);
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/fundi/bookings/:id", protect, requireRole("fundi"), requireVerifiedFundi, async (req, res) => {
  try {
    const booking = await getBookingById(req.params.id, req.user._id, "fundi");
    res.json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put("/fundi/location", protect, requireRole("fundi"), async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await updateFundiLocation(req.user._id, lat, lng);
    res.json({ success: true, message: "Location updated" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/fundi/bookings/:id/price", protect, requireRole("fundi"), requireVerifiedFundi, async (req, res) => {
  try {
    const { price, action } = req.body;
    const booking = await negotiatePrice(req.params.id, req.user._id, "fundi", { price, action });
    res.json({ success: true, booking });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update fundi availability status
router.put("/fundi/availability", protect, requireRole("fundi"), requireVerifiedFundi, async (req, res) => {
  try {
    const { isAvailable, availableForNegotiation } = req.body;
    const FundiProfile = require("../models/FundiProfile");
    const update = {};
    if (typeof isAvailable === "boolean") update.isAvailable = isAvailable;
    if (typeof availableForNegotiation === "boolean") update.availableForNegotiation = availableForNegotiation;
    await FundiProfile.findOneAndUpdate(
      { userId: req.user._id },
      update
    );
    res.json({ success: true, message: "Availability updated" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Upload image for a booking (client uploads photos for fundi to see)
router.post("/upload", protect, uploadBooking.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }
    const { bookingId } = req.body;
    const url = storageFileUrl("bookings", req.file.filename);

    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: "Booking not found" });
      }
      if (booking.clientId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
      booking.images = booking.images || [];
      booking.images.push(url);
      await booking.save();
    }

    return res.json({ success: true, url });
  } catch (error) {
    console.error("Error uploading booking image:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
