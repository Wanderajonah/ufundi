const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "jobs",
  name: "Job",
  timestamps: true,
  jsonbColumns: ["location"],
  refs: { customerId: "User", fundiId: "User" },
});