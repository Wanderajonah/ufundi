const FundiProfile = require("../models/FundiProfile");
const User = require("../models/User");
const Review = require("../models/Review");
const { getRecommendations } = require("../services/recommendationService");
const { filterByRadius, normalizeCoords } = require("../utils/geo");
const { buildSkillsQuery } = require("../utils/trades");

// Batch-attach review counts so profile cards show "X reviews" without N+1
// queries from the client.
const attachReviewCounts = async (fundis) => {
  const ids = fundis.map((f) => f._id).filter(Boolean);
  if (!ids.length) return fundis;
  const counts = await Review.aggregate([
    { $match: { fundiId: { $in: ids } } },
    { $group: { _id: "$fundiId", count: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  return fundis.map((f) => ({
    ...f,
    reviewCount: byId.get(String(f._id)) || 0,
  }));
};

const getFundis = async (req, res, next) => {
  try {
    const { category, lat, lng, radiusKm = 20, excludeUserId, excludePhone, excludeEmail } = req.query;
    const query = { ...(category && category !== "all" ? buildSkillsQuery(category) : {}), verificationStatus: "verified" };

    const excludeIds = new Set();
    if (excludeUserId) excludeIds.add(excludeUserId);
    if (excludePhone || excludeEmail) {
      const or = [];
      if (excludePhone) or.push({ phone: excludePhone });
      if (excludeEmail) or.push({ email: excludeEmail });
      const siblings = await User.find({
        $or: [{ role: "fundi" }, { fundiEnabled: true }, ...or],
      }).select("_id");
      siblings.forEach((s) => excludeIds.add(String(s._id)));
    }

    let fundis = await FundiProfile.find(query)
      .populate({
        path: "userId",
        match: {
          "location.lat": { $ne: 0 },
          "location.lng": { $ne: 0 },
          ...(excludeIds.size && { _id: { $nin: [...excludeIds] } }),
        },
        select: "-password",
      });

    if (lat && lng) {
      const origin = normalizeCoords(lat, lng);
      const radius = Math.min(50, Math.max(1, Number(radiusKm)));
      const inRadius = filterByRadius(origin, fundis, radius, (f) => f.userId?.location);
      fundis = inRadius.map(({ item, distanceKm }) => {
        const plain = item.toObject();
        plain.distanceKm = Number(distanceKm.toFixed(2));
        return plain;
      });
      const recommendations = getRecommendations(origin, fundis, 5);
      return res.json(await attachReviewCounts(recommendations));
    }

    return res.json(await attachReviewCounts(fundis.map((f) => f.toObject())));
  } catch (error) {
    return next(error);
  }
};

const getFundiById = async (req, res, next) => {
  try {
    const fundi = await FundiProfile.findOne({ _id: req.params.id, verificationStatus: "verified" }).populate("userId", "-password");
    if (!fundi) return res.status(404).json({ message: "Fundi not found" });
    const [withStats] = await attachReviewCounts([fundi.toObject()]);
    return res.json(withStats);
  } catch (error) {
    return next(error);
  }
};

const getNegotiableFundis = async (req, res, next) => {
  try {
    const { category, lat, lng, radiusKm = 20, excludeUserId, excludePhone, excludeEmail } = req.query;
    const query = { availableForNegotiation: true, verificationStatus: "verified" };
    if (category && category !== "all") {
      query.$or = [{ skills: category }, { skills: { $in: [category] } }];
    }

    const excludeIds = new Set();
    if (excludeUserId) excludeIds.add(excludeUserId);
    if (excludePhone || excludeEmail) {
      const or = [];
      if (excludePhone) or.push({ phone: excludePhone });
      if (excludeEmail) or.push({ email: excludeEmail });
      const siblings = await User.find({
        $or: [{ role: "fundi" }, { fundiEnabled: true }, ...or],
      }).select("_id");
      siblings.forEach((s) => excludeIds.add(String(s._id)));
    }

    let fundis = await FundiProfile.find(query)
      .populate({
        path: "userId",
        match: {
          "location.lat": { $ne: 0 },
          "location.lng": { $ne: 0 },
          ...(excludeIds.size && { _id: { $nin: [...excludeIds] } }),
        },
        select: "-password",
      });

    if (lat && lng) {
      const origin = normalizeCoords(lat, lng);
      const radius = Math.min(50, Math.max(1, Number(radiusKm)));
      const inRadius = filterByRadius(origin, fundis, radius, (f) => f.userId?.location);
      fundis = inRadius.map(({ item, distanceKm }) => {
        const plain = item.toObject();
        plain.distanceKm = Number(distanceKm.toFixed(2));
        return plain;
      });
    }

    return res.json(await attachReviewCounts(fundis.map((f) => f.toObject())));
  } catch (error) {
    return next(error);
  }
};

module.exports = { getFundis, getFundiById, getNegotiableFundis };
