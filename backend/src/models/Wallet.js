const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "wallets",
  name: "Wallet",
  timestamps: true,
  refs: { userId: "User" },
});