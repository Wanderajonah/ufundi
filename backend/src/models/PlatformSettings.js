const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "platform_settings",
  name: "PlatformSettings",
  timestamps: true,
  jsonbColumns: ["notifications", "paymentIntegrations"],
});