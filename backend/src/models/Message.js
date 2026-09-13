const { createModel } = require("../db/shim");

module.exports = createModel({
  tableName: "messages",
  name: "Message",
  timestamps: true,
  jsonbColumns: [],
  refs: { conversationId: "Conversation", senderId: "User" },
});