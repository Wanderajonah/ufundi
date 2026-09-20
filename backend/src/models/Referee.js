const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "referees",
  name: "Referee",
  timestamps: true,
  jsonbColumns: [],
  refs: { userId: "User" },
});
