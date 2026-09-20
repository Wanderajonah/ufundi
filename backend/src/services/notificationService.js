const { sendBookingSms } = require("./bookingSmsService");
const { generateSms } = require("./groqService");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Push notifications are only delivered in production builds. In development
// the app runs through Metro/Expo Go where remote push is not supported, so
// we skip the Expo push API entirely.
const PUSH_ENABLED = process.env.NODE_ENV === "production";

// This will be set when socket.io is initialized
let io = null;

function setIo(socketIo) {
  io = socketIo;
}

// A user counts as online only if their socket is actually connected.
// This guards against stale isOnline/socketId state after a dropped connection.
function isOnline(user) {
  return Boolean(user && user.socketId && io && io.sockets.sockets.get(user.socketId));
}

function formatPushMessage(event, data, recipient) {
  switch (event) {
    case "booking_request":
      return {
        title: "New job request",
        body: `${data.category || "Job"} at ${data.address || "your area"}. ${
          data.clientName ? `Client: ${data.clientName}. ` : ""
        }Open the app to respond within 5 min.`,
      };
    case "booking_accepted":
      if (recipient === "client") {
        return {
          title: "Booking accepted!",
          body: `${data.fundiName || "A fundi"} accepted your booking and is on the way.`,
        };
      }
      return null;
    case "booking_declined":
      if (recipient === "client") {
        return {
          title: "A fundi declined",
          body: "We are finding another available fundi for you.",
        };
      }
      return null;
    case "booking_cancelled":
      if (recipient === "client") {
        return {
          title: "Booking cancelled",
          body: `Your booking was cancelled. Reason: ${data.reason || "Not specified"}`,
        };
      }
      return {
        title: "Booking cancelled",
        body: `The client cancelled the booking. Reason: ${data.reason || "Not specified"}`,
      };
    case "booking_expired":
      if (recipient === "fundi") {
        return {
          title: "Job request expired",
          body: "A job request expired as no fundi responded in time.",
        };
      }
      return null;
    case "status_on_the_way":
      if (recipient === "client") {
        return { title: "Fundi is on the way", body: "Track their location in the app." };
      }
      return null;
    case "status_arrived":
      if (recipient === "client") {
        return { title: "Fundi arrived", body: "Your fundi has arrived at your location." };
      }
      return null;
    case "status_in_progress":
      if (recipient === "client") {
        return { title: "Job started", body: "Your fundi has started working on your job." };
      }
      return null;
    case "status_completed":
      if (recipient === "fundi") {
        return {
          title: "Job complete",
          body: "The client confirmed the job is complete. Thank you for your service!",
        };
      }
      return null;
    case "completion_confirm":
      if (recipient === "client") {
        return {
          title: "Confirm job completion",
          body: `${data.name || "Your fundi"} marked the job as done. Confirm and release payment.`,
        };
      }
      return {
        title: "Job confirmed",
        body: "The client confirmed the job. Open the app to confirm and receive your payment.",
      };
    case "no_fundi_available":
      if (recipient === "client") {
        return {
          title: "No fundis available",
          body: "Sorry, no fundis are available right now. Please try again later.",
        };
      }
      return null;
    case "verification_approved":
      return {
        title: "You're verified!",
        body: "Your Ufundi profile has been verified. You can now receive job requests and start earning.",
      };
    case "verification_rejected":
      return {
        title: "Verification not approved",
        body: data.notes
          ? `Reason: ${data.notes}`
          : "Please review your documents and re-submit for verification.",
      };
    case "price_update":
      if (recipient === "client") {
        return {
          title: data.priceAgreed ? "Price agreed" : "New price proposal",
          body: data.priceAgreed
            ? `Agreed at UGX ${Number(data.agreedPrice || 0).toLocaleString()}. Proceed to payment in the app.`
            : `UGX ${Number(data.proposedPrice || 0).toLocaleString()}. Open the app to respond.`,
        };
      }
      return {
        title: data.priceAgreed ? "Price agreed" : "New price proposal",
        body: data.priceAgreed
          ? `Client agreed to UGX ${Number(data.agreedPrice || 0).toLocaleString()}.`
          : `UGX ${Number(data.proposedPrice || 0).toLocaleString()}. Open the app to respond.`,
      };
    default:
      return null;
  }
}

// Send an Expo push notification to a user's registered device token.
async function sendPush(user, event, data, role) {
  if (!user || !user.pushToken) return false;
  const message = formatPushMessage(event, data, role);
  if (!message) return false;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([
        {
          to: user.pushToken,
          title: message.title,
          body: message.body,
          data: { event, ...data },
          sound: "default",
          priority: "high",
        },
      ]),
    });
    const json = await res.json();
    const ok = json?.data?.[0]?.status === "ok";
    if (!ok) {
      const err = json?.data?.[0]?.message;
      if (err) console.error(`Push rejected for ${role} ${user._id}:`, err);
    }
    return ok;
  } catch (error) {
    console.error(`Push failed for ${role} ${user._id} event ${event}:`, error.message);
    return false;
  }
}

async function buildSmsMessage(event, data, recipient) {
  try {
    const generated = await generateSms(event, data, recipient);
    if (generated) return generated;
  } catch (error) {
    console.error("AI SMS generation failed:", error.message);
  }
  return formatSmsMessage(event, data, recipient);
}

// Feed category used by the mobile bell screen's chips.
function feedType(event) {
  if (event === "new_message") return "message";
  if (event.startsWith("verification")) return "system";
  return "booking";
}

// Persist a notification into the user's in-app feed. Returns the saved row
// (so the app can show it live) or null when the event has no title/body for
// this recipient role.
async function persistInApp(userId, event, data, role) {
  try {
    const message = formatPushMessage(event, data, role);
    if (!message) return null;
    const Notification = require("../models/Notification");
    const payload = { event };
    if (data) {
      for (const key of ["bookingId", "senderId", "conversationId"]) {
        if (data[key] != null) payload[key] = data[key];
      }
    }
    const saved = await Notification.create({
      userId: userId.toString(),
      type: feedType(event),
      title: message.title,
      body: message.body || "",
      data: payload,
    });
    return saved;
  } catch (error) {
    console.error(`Failed to persist in-app notification for ${role} ${userId}:`, error.message);
    return null;
  }
}

// Deliver a notification to a user:
//  - always: a row is saved to the in-app feed (the bell screen) and, when the
//            user is online, a `user_notification` socket event keeps it live
//  - online (app foreground)   -> socket event too
//  - offline (app backgrounded) -> push notification, plus SMS unless allowSms is false
//                                (high-frequency events like counter-proposals rely
//                                on in-app polling instead of paid SMS)
async function deliver(userId, event, data, role, { allowSms = true } = {}) {
  const channels = [];
  try {
    const User = require("../models/User");
    const user = await User.findById(userId);
    if (!user) return channels;

    const saved = await persistInApp(userId, event, data, role);
    if (saved) channels.push("in-app");

    if (isOnline(user)) {
      io.to(user.socketId).emit(event, data);
      channels.push("socket");
      if (saved) io.to(user.socketId).emit("user_notification", saved);
      console.log(`Socket notification sent to ${role} ${userId} for event ${event}`);
      return channels;
    }

    if (user.pushToken && PUSH_ENABLED) {
      const pushed = await sendPush(user, event, data, role);
      if (pushed) {
        channels.push("push");
        console.log(`Push notification sent to ${role} ${userId} for event ${event}`);
      }
    }

    if (!allowSms) return channels;

    if (user.phone) {
      const message = await buildSmsMessage(event, data, role);
      if (message) {
        const result = await sendBookingSms({ toNumber: user.phone, message });
        if (result.success) {
          channels.push("sms");
        }
      }
    }
  } catch (error) {
    console.error(`Notification failed for ${role} ${userId}:`, error.message);
  }

  return channels;
}

async function notifyFundi(fundiId, event, data, options) {
  return deliver(fundiId, event, data, "fundi", options);
}

async function notifyClient(clientId, event, data, options) {
  return deliver(clientId, event, data, "client", options);
}

function formatSmsMessage(event, data, recipient) {
  switch (event) {
    case "booking_request":
      return `New job: ${data.category} at ${data.address}. Client: ${data.clientName}, Tel: ${data.clientPhone}. Call or open Ufundi app to respond within 5 min.`;

    case "booking_accepted":
      if (recipient === "client") {
        return `Your booking has been accepted! Fundi: ${data.fundiName}. Phone: ${data.fundiPhone}. They are on their way.`;
      }
      return "";

    case "booking_declined":
      if (recipient === "client") {
        return `A fundi declined your booking. We are finding another available fundi for you.`;
      }
      return "";

    case "booking_cancelled":
      if (recipient === "client") {
        return `Your booking has been cancelled by the fundi. Reason: ${data.reason || "Not specified"}`;
      }
      return `The client has cancelled the booking. Reason: ${data.reason || "Not specified"}`;

    case "booking_expired":
      if (recipient === "fundi") {
        return `A job request has expired as no fundi responded in time.`;
      }
      return "";

    case "status_on_the_way":
      if (recipient === "client") {
        return `Your fundi is on the way! Track their location in the app.`;
      }
      return "";

    case "status_arrived":
      if (recipient === "client") {
        return `Your fundi has arrived at your location.`;
      }
      return "";

    case "status_in_progress":
      if (recipient === "client") {
        return `Your fundi has started working on your job.`;
      }
      return "";

    case "status_completed":
      if (recipient === "fundi") {
        return `The client has confirmed the job is complete. Thank you for your service!`;
      }
      return "";

    case "completion_confirm":
      if (recipient === "client") {
        return `${data.name || "Your fundi"} marked the job as done. Open the app to confirm and release payment.`;
      }
      return `The client confirmed the job is complete. Open the app to confirm and receive your payment.`;

    case "no_fundi_available":
      if (recipient === "client") {
        return `Sorry, no fundis are available right now. Please try again later.`;
      }
      return "";

    case "verification_approved":
      return "Congratulations! Your Ufundi profile has been verified. You can now receive job requests and start earning. Welcome to the platform!";

    case "verification_rejected":
      return `Your Ufundi profile verification was not approved.${data.notes ? ` Reason: ${data.notes}.` : ""} Please review your documents and re-submit for verification in the app.`;

    case "price_update":
      if (recipient === "client") {
        return data.priceAgreed
          ? `Price agreed at UGX ${Number(data.agreedPrice || 0).toLocaleString()}. Proceed to payment in the app.`
          : `New price proposal: UGX ${Number(data.proposedPrice || 0).toLocaleString()}. Open the app to respond.`;
      }
      return data.priceAgreed
        ? `Client agreed to UGX ${Number(data.agreedPrice || 0).toLocaleString()}.`
        : `New price proposal: UGX ${Number(data.proposedPrice || 0).toLocaleString()}. Open the app to respond.`;

    default:
      return "";
  }
}

async function notifyFundiLocation(clientId, locationData) {
  try {
    const User = require("../models/User");
    const client = await User.findById(clientId);

    if (isOnline(client)) {
      io.to(client.socketId).emit("fundi_location_update", locationData);
      console.log(`Live location sent to client ${clientId}`);
    }
  } catch (error) {
    console.error(`Location update failed for client ${clientId}:`, error.message);
  }
}

// A new chat message arrived for a user who is not currently viewing the
// thread. Save it to their feed and, if they are online, ping them live so the
// bell lights up immediately.
async function notifyNewMessage(recipientId, data) {
  const body = data.imageUrl ? "Photo" : (data.text || "");
  try {
    const Notification = require("../models/Notification");
    const saved = await Notification.create({
      userId: recipientId.toString(),
      type: "message",
      title: data.senderName || "New message",
      body,
      data: { event: "new_message", senderId: data.senderId, conversationId: data.conversationId },
    });
    const User = require("../models/User");
    const user = await User.findById(recipientId);
    if (isOnline(user)) io.to(user.socketId).emit("user_notification", saved);
    return saved;
  } catch (error) {
    console.error(`Failed to persist chat notification for user ${recipientId}:`, error.message);
    return null;
  }
}

module.exports = {
  setIo,
  notifyFundi,
  notifyClient,
  notifyFundiLocation,
  notifyNewMessage
};
