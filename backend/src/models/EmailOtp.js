const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "email_otps",
  name: "EmailOtp",
  timestamps: true,
  upsertConflict: "email,purpose",
});