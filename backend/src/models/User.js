const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "users",
  name: "User",
  timestamps: true,
  jsonbColumns: ["location"],
  refs: {},
});