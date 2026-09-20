const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "notifications",
  name: "Notification",
  timestamps: true,
});