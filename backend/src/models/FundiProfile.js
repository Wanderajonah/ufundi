const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "fundiprofiles",
  name: "FundiProfile",
  timestamps: true,
  arrayColumns: ["skills", "verificationDocs", "portfolioImages"],
  jsonbColumns: ["currentLocation"],
  refs: { userId: "User" },
});