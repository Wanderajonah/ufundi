const Notification = require("../models/Notification");

// Latest notifications for the current user (newest first).
async function getNotifications(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const notifications = await Notification.find({ userId: req.user._id.toString() })
      .sort({ created_at: -1 })
      .limit(limit);
    res.json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
}

// Number of unread notifications for the bell badge.
async function getUnreadCount(req, res) {
  try {
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id.toString(),
      read: false,
    });
    res.json({ unreadCount });
  } catch (error) {
    console.error("Error counting unread notifications:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
}

// Mark a single notification as read.
async function markRead(req, res) {
  try {
    await Notification.updateOne(
      { _id: req.params.id, userId: req.user._id.toString() },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification read:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
}

// Mark every notification for the current user as read.
async function markAllRead(req, res) {
  try {
    await Notification.updateMany(
      { userId: req.user._id.toString(), read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notifications read:", error);
    res.status(500).json({ error: "Failed to update notifications" });
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
};