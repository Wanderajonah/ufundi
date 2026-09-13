const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const FundiProfile = require("../models/FundiProfile");
const { getBotResponse } = require("../services/supportBotService");
const { filterByRadius, normalizeCoords } = require("../utils/geo");
const { getRecommendations } = require("../services/recommendationService");
const { buildSkillsQuery, guessTradeFromText } = require("../utils/trades");
const { storageFileUrl } = require("../services/gridfsStorage");

async function getOrCreateConversation(req, res) {
  try {
    const { bookingId, targetUserId } = req.body;
    const userId = req.user._id;

    if (targetUserId) {
      const participants = [userId, targetUserId].sort();
      let conversation = await Conversation.findOne({
        participants: { $all: participants, $size: 2 },
        bookingId: bookingId || null,
        type: "booking"
      });
      if (!conversation) {
        conversation = await Conversation.create({
          participants,
          bookingId: bookingId || null,
          type: "booking"
        });
      }
      return res.json({ success: true, conversation });
    }

    return res.status(400).json({ success: false, message: "targetUserId is required" });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getConversations(req, res) {
  try {
    const userId = req.user._id;
    const conversations = await Conversation.find({
      participants: userId
    })
      .populate("participants", "name phone role")
      .populate("lastSenderId", "name")
      .sort({ updatedAt: -1 });

    return res.json({ success: true, conversations });
  } catch (error) {
    console.error("Error getting conversations:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getMessages(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!conversation.participants.some(p => p.toString() === userId.toString())) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const messages = await Message.find({ conversationId: id })
      .populate("senderId", "name role")
      .sort({ createdAt: 1 });

    return res.json({ success: true, messages });
  } catch (error) {
    console.error("Error getting messages:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function sendMessage(req, res) {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Message text is required" });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!conversation.participants.some(p => p.toString() === userId.toString())) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const message = await Message.create({
      conversationId: id,
      senderId: userId,
      text: text.trim()
    });

    conversation.lastMessage = text.trim();
    conversation.lastSenderId = userId;
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populated = await Message.findById(message._id).populate("senderId", "name role");

    return res.status(201).json({ success: true, message: populated });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function supportChat(req, res) {
  try {
    const { message, history, imageUrl, lat, lng } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    const messages = [
      ...(Array.isArray(history) ? history : []),
      { role: "user", content: message.trim() }
    ];

    const result = await getBotResponse({ messages, imageUrl, userText: message.trim() });
    const reply = result.reply;
    let category = result.category;

    // If the analysis didn't identify a trade (general/unknown), infer one from the
    // message text so we still only match fundis with the relevant skills.
    if (!category) {
      const lastUserText = [...messages].reverse().find((m) => m.role === "user")?.content;
      category = guessTradeFromText(message.trim()) || guessTradeFromText(lastUserText) || null;
    }

    let recommendation = null;
    const originLat = Number(lat) || req.user?.location?.lat;
    const originLng = Number(lng) || req.user?.location?.lng;

    // Only recommend fundis whose skills match the job trade (e.g. plumbers, not cleaners).
    const query = { ...(category ? buildSkillsQuery(category) : {}), verificationStatus: "verified", isAvailable: true };
    let fundis = await FundiProfile.find(query)
      .populate({ path: "userId", select: "-password" })
      .limit(50);

    if (originLat && originLng) {
      const origin = normalizeCoords(originLat, originLng);
      const inRadius = filterByRadius(origin, fundis, 25, (f) => f.userId?.location);
      fundis = inRadius.map(({ item, distanceKm }) => {
        const plain = item.toObject();
        plain.distanceKm = Number(distanceKm.toFixed(2));
        return plain;
      });
      const scored = getRecommendations(origin, fundis, 3);
      if (scored.length) {
        recommendation = { category, fundis: scored };
      }
    } else if (category) {
      // no location available: fall back to top-rated of the matched trade
      recommendation = { category, fundis: fundis.slice(0, 3) };
    }

    return res.json({ success: true, reply, recommendation });
  } catch (error) {
    console.error("Error in support chat:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function markAsRead(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!conversation.participants.some(p => p.toString() === userId.toString())) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await Message.updateMany(
      { conversationId: id, senderId: { $ne: userId }, read: false },
      { read: true }
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function uploadChatImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }
    const url = storageFileUrl("chat", req.file.filename);
    return res.json({ success: true, url });
  } catch (error) {
    console.error("Error uploading chat image:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  uploadChatImage,
  supportChat,
  markAsRead
};
