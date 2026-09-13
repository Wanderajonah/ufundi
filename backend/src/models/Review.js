const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "reviews",
  name: "Review",
  timestamps: true,
  arrayColumns: ["photoUrls"],
  refs: { fundiId: "User", customerId: "User", jobId: "Job" },
});