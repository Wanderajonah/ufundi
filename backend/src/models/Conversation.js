const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "conversations",
  name: "Conversation",
  timestamps: true,
  arrayColumns: ["participants"],
  refs: { participants: "User", bookingId: "Booking", lastSenderId: "User" },
});