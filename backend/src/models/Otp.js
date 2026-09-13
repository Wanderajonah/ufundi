const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "otps",
  name: "Otp",
  timestamps: true,
  upsertConflict: "phone,purpose",
});