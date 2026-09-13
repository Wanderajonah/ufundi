const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "bookings",
  name: "Booking",
  timestamps: true,
  arrayColumns: ["images"],
  jsonbColumns: ["location", "notifiedFundis", "fundiLocation"],
  refs: { clientId: "User", fundiId: "User" },
});