const Booking = require("../models/Booking");
const User = require("../models/User");
const FundiProfile = require("../models/FundiProfile");
const Conversation = require("../models/Conversation");
const { notifyFundi, notifyClient } = require("./notificationService");
const { buildSkillsQuery } = require("../utils/trades");

// Timer storage for 5-minute expiry
const bookingTimers = new Map();

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function findNearestAvailableFundis(lat, lng, category, radiusKm = 50, excludeIds = []) {
  try {
    // Find fundis with matching skills
    const fundiProfiles = await FundiProfile.find({
      ...buildSkillsQuery(category),
      isAvailable: true,
      verificationStatus: "verified",
    }).populate("userId");
    
    // Filter by distance and exclude already notified fundis
    const availableFundis = fundiProfiles
      .filter(fp => {
        // Use FundiProfile.currentLocation, fall back to User.location
        const fundiLat = fp.currentLocation?.lat ?? fp.userId?.location?.lat;
        const fundiLng = fp.currentLocation?.lng ?? fp.userId?.location?.lng;
        
        if (!fundiLat || !fundiLng) {
          return false;
        }
        
        const distance = calculateDistance(lat, lng, fundiLat, fundiLng);
        
        return distance <= radiusKm && !excludeIds.includes(fp.userId._id.toString());
      })
      .map(fp => {
        const fundiLat = fp.currentLocation?.lat ?? fp.userId?.location?.lat;
        const fundiLng = fp.currentLocation?.lng ?? fp.userId?.location?.lng;
        return {
          fundiId: fp.userId._id,
          distance: calculateDistance(lat, lng, fundiLat, fundiLng),
          profile: fp
        };
      })
      .sort((a, b) => a.distance - b.distance);
    
    return availableFundis;
  } catch (error) {
    console.error("Error finding nearest fundis:", error);
    return [];
  }
}

async function createBooking(clientId, bookingData) {
  try {
    const { category, description, address, location, images, estimatedDuration, fundiId } = bookingData;
    
    // Create booking
    const booking = new Booking({
      clientId,
      category,
      description,
      address,
      location,
      images: images || [],
      estimatedDuration: estimatedDuration || 60,
      status: "PENDING",
      currentFundiIndex: 0
    });
    
    await booking.save();
    
    if (fundiId) {
      // Direct booking to a specific fundi chosen by the client
      const fundi = await User.findById(fundiId);
      const fundiProfile = fundi && await FundiProfile.findOne({ userId: fundi._id, verificationStatus: "verified" });
      if (!fundi || !fundiProfile || (fundi.role !== "fundi" && !fundi.fundiEnabled)) {
        booking.status = "CANCELLED";
        booking.cancelledBy = "SYSTEM";
        booking.cancellationReason = "Selected fundi not found";
        booking.cancelledAt = new Date();
        await booking.save();
        throw new Error("Selected fundi not found");
      }

      booking.notifiedFundis.push({
        fundiId: fundi._id,
        notifiedAt: new Date(),
        notificationChannels: []
      });
      booking.currentFundiIndex = booking.notifiedFundis.length - 1;
      booking.expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min expiry for direct booking
      await booking.save();

      const client = await User.findById(clientId);
      const notificationChannels = await notifyFundi(fundi._id, "booking_request", {
        bookingId: booking._id,
        category: booking.category,
        description: booking.description,
        address: booking.address,
        location: booking.location,
        clientName: client.name,
        clientPhone: client.phone,
        expiresAt: booking.expiresAt,
        timeLeft: 1800
      });

      booking.notifiedFundis[booking.notifiedFundis.length - 1].notificationChannels = notificationChannels;
      await booking.save();

      console.log(`Booking ${booking._id} sent directly to fundi ${fundi._id}`);
    } else {
      // Auto-assign to nearest available fundi
      await sendToNextFundi(booking);
    }
    
    return booking;
  } catch (error) {
    console.error("Error creating booking:", error);
    throw error;
  }
}

async function sendToNextFundi(booking) {
  try {
    // Get already notified fundi IDs
    const notifiedFundiIds = booking.notifiedFundis.map(n => n.fundiId.toString());
    
    // Search progressively wider areas so a client is never told "no fundis"
    // just because nobody matched within the immediate radius. We expand the
    // radius in steps before eventually giving up.
    const RADIUS_STEPS = [50, 100, 200]; // km
    let availableFundis = [];
    let foundRadius = 0;
    for (const radiusKm of RADIUS_STEPS) {
      availableFundis = await findNearestAvailableFundis(
        booking.location.lat,
        booking.location.lng,
        booking.category,
        radiusKm,
        notifiedFundiIds
      );
      if (availableFundis.length > 0) {
        foundRadius = radiusKm;
        break;
      }
    }
    
    if (availableFundis.length === 0) {
      // No more fundis available even after widening the search area
      await handleNoFundiAvailable(booking);
      return;
    }
    
    // Get the next fundi
    const nextFundi = availableFundis[0];
    
    // Add to notified fundis
    booking.notifiedFundis.push({
      fundiId: nextFundi.fundiId,
      notifiedAt: new Date(),
      notificationChannels: []
    });
    
    booking.currentFundiIndex = booking.notifiedFundis.length - 1;
    
    // Set 5-minute expiry
    booking.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    
    await booking.save();
    
    // Notify the fundi
    const client = await User.findById(booking.clientId);
 const notificationChannels = await notifyFundi(nextFundi.fundiId, "booking_request", {
      bookingId: booking._id,
      category: booking.category,
      description: booking.description,
      address: booking.address,
      location: booking.location,
      clientName: client.name,
      clientPhone: client.phone,
      expiresAt: booking.expiresAt,
      timeLeft: 300, // 5 minutes in seconds
      distanceKm: Math.round(nextFundi.distance * 10) / 10,
      searchRadiusKm: foundRadius // surface how far we had to look
    });
    
    // Update notification channels
    const notifiedFundiIndex = booking.notifiedFundis.length - 1;
    booking.notifiedFundis[notifiedFundiIndex].notificationChannels = notificationChannels;
    await booking.save();
    
    // Start 5-minute timer
    startExpiryTimer(booking._id);
    
    console.log(`Booking ${booking._id} sent to fundi ${nextFundi.fundiId}`);
    
  } catch (error) {
    console.error("Error sending to next fundi:", error);
  }
}

function startExpiryTimer(bookingId) {
  // Clear existing timer if any
  if (bookingTimers.has(bookingId)) {
    clearTimeout(bookingTimers.get(bookingId));
  }
  
  const timer = setTimeout(async () => {
    try {
      const booking = await Booking.findById(bookingId);
      
      if (!booking || booking.status !== "PENDING") {
        bookingTimers.delete(bookingId);
        return;
      }
      
      console.log(`Booking ${bookingId} expired, moving to next fundi`);
      await sendToNextFundi(booking);
      
    } catch (error) {
      console.error("Error handling expiry timer:", error);
    }
  }, 5 * 60 * 1000); // 5 minutes
  
  bookingTimers.set(bookingId, timer);
}

function clearExpiryTimer(bookingId) {
  if (bookingTimers.has(bookingId)) {
    clearTimeout(bookingTimers.get(bookingId));
    bookingTimers.delete(bookingId);
  }
}

async function handleNoFundiAvailable(booking) {
  try {
    booking.status = "CANCELLED";
    booking.cancelledBy = "SYSTEM";
    booking.cancellationReason = "No fundi available";
    booking.cancelledAt = new Date();
    booking.expiresAt = null;
    
    clearExpiryTimer(booking._id);
    await booking.save();
    
    // Notify client
    await notifyClient(booking.clientId, "no_fundi_available", {
      bookingId: booking._id
    });
    
    console.log(`Booking ${booking._id} cancelled - no fundi available`);
    
  } catch (error) {
    console.error("Error handling no fundi available:", error);
  }
}

async function ensureBookingConversation(booking) {
  try {
    if (!booking.fundiId || !booking.clientId) return null;
    const participants = [booking.clientId.toString(), booking.fundiId.toString()].sort();
    // One conversation per pair of users. Rebooking the same fundi (or a new
    // booking) reuses the existing chat instead of creating another one.
    let conversation = await Conversation.findOne({
      participants: { $all: participants, $size: 2 },
      type: "booking",
    });
    if (!conversation) {
      conversation = await Conversation.create({
        participants,
        bookingId: booking._id,
        type: "booking",
      });
    } else if (!conversation.bookingId) {
      conversation.bookingId = booking._id;
      await conversation.save();
    }
    return conversation;
  } catch (error) {
    console.error("Error ensuring booking conversation:", error.message);
    return null;
  }
}

async function acceptBooking(bookingId, fundiId) {
  try {
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      throw new Error("Booking not found");
    }

    // Idempotent: already accepted by the same fundi (e.g. double tap / retry).
    if (
      booking.status === "ACCEPTED" &&
      booking.fundiId &&
      booking.fundiId.toString() === fundiId.toString()
    ) {
      return booking;
    }

    if (booking.status !== "PENDING") {
      throw new Error("Booking not available for acceptance");
    }
    
    // Verify this fundi was notified
    const wasNotified = booking.notifiedFundis.some(
      n => n.fundiId.toString() === fundiId.toString()
    );
    
    if (!wasNotified) {
      throw new Error("Fundi was not notified for this booking");
    }
    
    booking.fundiId = fundiId;
    booking.status = "ACCEPTED";
    booking.acceptedAt = new Date();
    booking.expiresAt = null;
    
    clearExpiryTimer(booking._id);
    await booking.save();
    
    // Notify client
    const fundi = await User.findById(fundiId);
    await notifyClient(booking.clientId, "booking_accepted", {
      bookingId: booking._id,
      fundiName: fundi.name,
      fundiPhone: fundi.phone
    });

    // Auto-create a booking conversation so negotiation/chat works immediately.
    await ensureBookingConversation(booking);
    
    console.log(`Booking ${bookingId} accepted by fundi ${fundiId}`);
    
    return booking;
  } catch (error) {
    console.error("Error accepting booking:", error);
    throw error;
  }
}

async function declineBooking(bookingId, fundiId) {
  try {
    const booking = await Booking.findById(bookingId);
    
    if (!booking || booking.status !== "PENDING") {
      throw new Error("Booking not available for decline");
    }
    
    // Verify this fundi was notified
    const wasNotified = booking.notifiedFundis.some(
      n => n.fundiId.toString() === fundiId.toString()
    );
    
    if (!wasNotified) {
      throw new Error("Fundi was not notified for this booking");
    }
    
    // Move to next fundi
    await sendToNextFundi(booking);
    
    console.log(`Booking ${bookingId} declined by fundi ${fundiId}, moving to next`);
    
    return booking;
  } catch (error) {
    console.error("Error declining booking:", error);
    throw error;
  }
}

async function updateBookingStatus(bookingId, fundiId, newStatus) {
  try {
    // Fundi-driven completion must go through dual confirmation.
    if (newStatus === "COMPLETED") {
      return await confirmBookingCompletion(bookingId, "fundi");
    }

    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      throw new Error("Booking not found");
    }
    
    // Verify fundi owns this booking
    if (booking.fundiId.toString() !== fundiId.toString()) {
      throw new Error("Fundi is not assigned to this booking");
    }
    
    // Validate status transitions
    const validTransitions = {
      "ACCEPTED": ["ON_THE_WAY", "CANCELLED"],
      "ON_THE_WAY": ["ARRIVED", "CANCELLED"],
      "ARRIVED": ["IN_PROGRESS", "CANCELLED"],
      "IN_PROGRESS": ["COMPLETED", "DISPUTED", "CANCELLED"]
    };
    
    if (!validTransitions[booking.status].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${booking.status} to ${newStatus}`);
    }

    // Negotiation phase is mandatory: the fundi cannot start the job until a
    // price has been agreed between both parties.
    if (
      booking.status === "ACCEPTED" &&
      newStatus !== "CANCELLED" &&
      !booking.priceAgreed
    ) {
      throw new Error("Agree on a service price with the client before starting the job");
    }

    booking.status = newStatus;
    
    // Set timestamps
    switch (newStatus) {
      case "ON_THE_WAY":
        booking.onTheWayAt = new Date();
        break;
      case "ARRIVED":
        booking.arrivedAt = new Date();
        break;
      case "IN_PROGRESS":
        booking.startedAt = new Date();
        break;
      case "COMPLETED":
        booking.completedAt = new Date();
        break;
    }
    
    await booking.save();
    
    // Release escrow once the job is completed (idempotent).
    if (newStatus === "COMPLETED" && booking.paymentStatus === "held") {
      try {
        const { releaseEscrow } = require("../controllers/walletController");
        await releaseEscrow(booking._id.toString());
        console.log(`Escrow released for booking ${bookingId}`);
      } catch (escrowErr) {
        console.error("Failed to release escrow:", escrowErr.message);
      }
    }
    
    // Notify client of status update. In-flight status changes
    // (on_the_way / arrived / in_progress) are delivered in-app only via
    // socket push and polling -- we explicitly disable paid SMS here so status
    // updates never burn SMS credits in production.
    const eventMap = {
      "ON_THE_WAY": "status_on_the_way",
      "ARRIVED": "status_arrived",
      "IN_PROGRESS": "status_in_progress"
    };

    if (eventMap[newStatus]) {
      await notifyClient(booking.clientId, eventMap[newStatus], {
        bookingId: booking._id,
        status: newStatus
      }, { allowSms: false });
    }
    
    console.log(`Booking ${bookingId} status updated to ${newStatus}`);
    
    return booking;
  } catch (error) {
    console.error("Error updating booking status:", error);
    throw error;
  }
}

async function confirmBookingCompletion(bookingId, role) {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    if (booking.status !== "IN_PROGRESS") {
      throw new Error("Job must be in progress to be marked complete");
    }

    const isClient = role === "customer";
    if (isClient) {
      booking.clientCompleted = true;
      booking.clientCompletedAt = new Date();
    } else {
      booking.fundiCompleted = true;
      booking.fundiCompletedAt = new Date();
    }

    // Release only when BOTH parties have confirmed.
    if (!(booking.clientCompleted && booking.fundiCompleted)) {
      await booking.save();
      if (isClient) {
        await notifyFundi(booking.fundiId, "completion_confirm", {
          bookingId: booking._id,
        });
      } else {
        await notifyClient(booking.clientId, "completion_confirm", {
          bookingId: booking._id,
        });
      }
      console.log(
        `Booking ${bookingId}: ${role} confirmed completion, waiting for the other party`
      );
      return booking;
    }

    booking.status = "COMPLETED";
    booking.completedAt = new Date();
    if (booking.startedAt) {
      booking.actualDuration = Math.floor(
        (new Date() - booking.startedAt) / (1000 * 60)
      );
    }
    await booking.save();

    // Count the finished job on the fundi's public profile.
    try {
      const FundiProfile = require("../models/FundiProfile");
      await FundiProfile.updateOne(
        { userId: booking.fundiId },
        { $inc: { jobsCompleted: 1 } }
      );
    } catch (statErr) {
      console.error("Failed to update fundi job count:", statErr.message);
    }

    if (booking.paymentStatus === "held") {
      try {
        const { releaseEscrow } = require("../controllers/walletController");
        await releaseEscrow(booking._id.toString());
        console.log(`Escrow released for booking ${bookingId}`);
      } catch (escrowErr) {
        console.error("Failed to release escrow:", escrowErr.message);
      }
    }

    // Tell both sides the job is done.
    await notifyFundi(booking.fundiId, "status_completed", {
      bookingId: booking._id,
    });
    await notifyClient(booking.clientId, "status_completed", {
      bookingId: booking._id,
    });

    console.log(`Booking ${bookingId} completed by both parties`);
    return booking;
  } catch (error) {
    console.error("Error confirming booking completion:", error);
    throw error;
  }
}

async function completeBooking(bookingId, clientId) {
  try {
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw new Error("Booking not found");
    }

    // Verify client owns this booking
    if (booking.clientId.toString() !== clientId.toString()) {
      throw new Error("Client is not the owner of this booking");
    }

    return await confirmBookingCompletion(bookingId, "customer");
  } catch (error) {
    console.error("Error completing booking:", error);
    throw error;
  }
}

async function cancelBooking(bookingId, userId, role, reason) {
  try {
    const booking = await Booking.findById(bookingId);
    
    if (!booking) {
      throw new Error("Booking not found");
    }
    
    // Verify ownership
    if (role === "customer" && booking.clientId.toString() !== userId.toString()) {
      throw new Error("Client is not the owner of this booking");
    }
    
    if (role === "fundi" && booking.fundiId.toString() !== userId.toString()) {
      throw new Error("Fundi is not assigned to this booking");
    }
    
    // Cannot cancel completed bookings
    if (booking.status === "COMPLETED") {
      throw new Error("Cannot cancel a completed booking");
    }
    
    booking.status = "CANCELLED";
    booking.cancelledBy = role === "fundi" ? "FUNDI" : "CLIENT";
    booking.cancellationReason = reason || "Not specified";
    booking.cancelledAt = new Date();
    booking.expiresAt = null;
    
    clearExpiryTimer(booking._id);
    await booking.save();

    // Refund escrow if funds are held
    if (booking.paymentStatus === "held") {
      try {
        const { refundEscrow } = require("../controllers/walletController");
        await refundEscrow(booking._id.toString());
        console.log(`Escrow refunded for cancelled booking ${bookingId}`);
      } catch (escrowErr) {
        console.error("Failed to refund escrow:", escrowErr.message);
      }
    }
    
    // Notify the other party
    if (role === "customer") {
      await notifyFundi(booking.fundiId, "booking_cancelled", {
        bookingId: booking._id,
        reason: booking.cancellationReason
      });
    } else {
      await notifyClient(booking.clientId, "booking_cancelled", {
        bookingId: booking._id,
        reason: booking.cancellationReason
      });
    }
    
    console.log(`Booking ${bookingId} cancelled by ${role} ${userId}`);
    
    return booking;
  } catch (error) {
    console.error("Error cancelling booking:", error);
    throw error;
  }
}

async function getUserBookings(userId, role, status = null) {
  try {
    let bookings;
    
    if (role === "customer") {
      const query = { clientId: userId };
      if (status) {
        query.status = status;
      }
      bookings = await Booking.find(query)
        .populate("clientId", "name phone")
        .populate("fundiId", "name phone")
        .sort({ createdAt: -1 });
    } else {
      // For fundis, get both assigned bookings and pending notifications
      const query = {
        $or: [
          { fundiId: userId },
          { "notifiedFundis.fundiId": userId }
        ]
      };
      
      if (status) {
        query.status = status;
      }
      
      bookings = await Booking.find(query)
        .populate("clientId", "name phone")
        .populate("fundiId", "name phone")
        .sort({ createdAt: -1 });
      
      // Filter out bookings where this fundi was notified but already declined/expired
      bookings = bookings.filter(booking => {
        if (booking.fundiId && booking.fundiId._id.toString() === userId.toString()) {
          return true; // Assigned to this fundi
        }
        // Check if this fundi is currently being notified (latest notification)
        const latestNotification = booking.notifiedFundis[booking.notifiedFundis.length - 1];
        if (latestNotification && latestNotification.fundiId.toString() === userId.toString()) {
          return booking.status === "PENDING"; // Only show if still pending
        }
        return false;
      });
    }
    
    return bookings;
  } catch (error) {
    console.error("Error getting user bookings:", error);
    throw error;
  }
}

async function getBookingById(bookingId, userId, role) {
  try {
    const booking = await Booking.findById(bookingId)
      .populate("clientId", "name phone")
      .populate("fundiId", "name phone");
    
    if (!booking) {
      throw new Error("Booking not found");
    }
    
    // Verify access
    if (role === "customer" && booking.clientId._id.toString() !== userId.toString()) {
      throw new Error("Access denied");
    }
    
    if (role === "fundi") {
      // Fundi can access if assigned or currently being notified
      const isAssigned = booking.fundiId && booking.fundiId._id.toString() === userId.toString();
      const isNotified = booking.notifiedFundis.some(
        n => n.fundiId.toString() === userId.toString() && booking.status === "PENDING"
      );
      
      if (!isAssigned && !isNotified) {
        throw new Error("Access denied");
      }
    }
    
    return booking;
  } catch (error) {
    console.error("Error getting booking by ID:", error);
    throw error;
  }
}

async function updateFundiLocation(userId, lat, lng) {
  try {
    await FundiProfile.findOneAndUpdate(
      { userId },
      {
        currentLocation: { lat, lng },
        updatedAt: new Date()
      }
    );
  } catch (error) {
    console.error("Error updating fundi location:", error);
    throw error;
  }
}

async function negotiatePrice(bookingId, userId, role, { price, action }) {
  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status !== "ACCEPTED") {
      throw new Error("Price can only be negotiated after booking is accepted");
    }

    const roleKey = role === "customer" ? "CLIENT" : "FUNDI";

    if (role === "customer" && booking.clientId.toString() !== userId.toString()) {
      throw new Error("Access denied");
    }

    if (role === "fundi" && (!booking.fundiId || booking.fundiId.toString() !== userId.toString())) {
      throw new Error("Access denied");
    }

    if (action === "propose") {
      const amount = Number(price);
      if (!amount || amount <= 0) {
        throw new Error("Invalid price");
      }

      booking.proposedPrice = amount;
      booking.proposedBy = roleKey;
      booking.clientPriceAgreed = roleKey === "CLIENT";
      booking.fundiPriceAgreed = roleKey === "FUNDI";
      booking.priceAgreed = false;
      booking.agreedPrice = null;
    } else if (action === "agree") {
      if (!booking.proposedPrice) {
        throw new Error("No price has been proposed yet");
      }

      if (booking.proposedBy === roleKey) {
        throw new Error("Wait for the other party to agree to your proposal");
      }

      if (roleKey === "CLIENT") {
        booking.clientPriceAgreed = true;
      } else {
        booking.fundiPriceAgreed = true;
      }

      booking.priceAgreed = true;
      booking.agreedPrice = booking.proposedPrice;
    } else {
      throw new Error("Invalid action");
    }

    await booking.save();

    const payload = {
      bookingId: booking._id,
      proposedPrice: booking.proposedPrice,
      proposedBy: booking.proposedBy,
      clientPriceAgreed: booking.clientPriceAgreed,
      fundiPriceAgreed: booking.fundiPriceAgreed,
      priceAgreed: booking.priceAgreed,
      agreedPrice: booking.agreedPrice
    };

    if (role === "customer") {
      // Negotiation never uses paid SMS — the app polls and loads fresh
      // state on open, so in-app delivery is always enough.
      await notifyFundi(booking.fundiId, "price_update", payload, {
        allowSms: false,
      });
    } else {
      await notifyClient(booking.clientId, "price_update", payload, {
        allowSms: false,
      });
    }

    return booking;
  } catch (error) {
    console.error("Error negotiating price:", error);
    throw error;
  }
}

module.exports = {
  createBooking,
  acceptBooking,
  declineBooking,
  updateBookingStatus,
  completeBooking,
  confirmBookingCompletion,
  cancelBooking,
  getUserBookings,
  getBookingById,
  updateFundiLocation,
  negotiatePrice,
  sendToNextFundi,
  clearExpiryTimer
};
