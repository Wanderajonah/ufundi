const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "transactions",
  name: "Transaction",
  timestamps: true,
  jsonbColumns: ["metadata"],
  refs: { walletId: "Wallet", userId: "User", relatedBooking: "Booking", relatedUser: "User" },
});