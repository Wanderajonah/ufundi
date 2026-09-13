const FundiProfile = require("../models/FundiProfile");
const User = require("../models/User");
const { getRecommendations } = require("../services/recommendationService");
const { geocodeAddress, reverseGeocode, buildRouteSummary, fetchDrivingRoute } = require("../services/mapsService");
const { filterByRadius, normalizeCoords } = require("../utils/geo");
const { buildSkillsQuery } = require("../utils/trades");

const geocode = async (req, res, next) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ message: "address query is required" });
    const result = await geocodeAddress(address);
    return res.json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

const reverse = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    if (lat == null || lng == null) {
      return res.status(400).json({ message: "lat and lng are required" });
    }
    const result = await reverseGeocode(lat, lng);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

const nearbyFundis = async (req, res, next) => {
  try {
    const { lat, lng, category, radiusKm = 10, excludeUserId, excludePhone, excludeEmail } = req.query;
    if (lat == null || lng == null) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const origin = normalizeCoords(lat, lng);
    const radius = Math.min(50, Math.max(1, Number(radiusKm)));
    const query = category && category !== "all" ? buildSkillsQuery(category) : {};

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

    const fundis = await FundiProfile.find({ ...query, verificationStatus: "verified", isAvailable: true })
      .populate({
        path: "userId",
        match: {
          "location.lat": { $ne: 0 },
          "location.lng": { $ne: 0 },
          ...(excludeIds.size && { _id: { $nin: [...excludeIds] } }),
        },
        select: "-password",
      });

    const inRadius = filterByRadius(
      origin,
      fundis,
      radius,
      (f) => f.userId?.location
    );

    const enriched = inRadius.map(({ item, distanceKm }) => {
      const plain = item.toObject();
      return {
        ...plain,
        distanceKm: Number(distanceKm.toFixed(2)),
        userId: plain.userId
      };
    });

    const scored = getRecommendations(origin, enriched, 20);

    return res.json({
      count: scored.length,
      radiusKm: radius,
      origin,
      fundis: scored
    });
  } catch (error) {
    return next(error);
  }
};

const routePreview = async (req, res, next) => {
  try {
    const { fromLat, fromLng, toLat, toLng } = req.query;
    if ([fromLat, fromLng, toLat, toLng].some((v) => v == null)) {
      return res.status(400).json({ message: "fromLat, fromLng, toLat, toLng are required" });
    }
    const summary = buildRouteSummary(
      normalizeCoords(fromLat, fromLng),
      normalizeCoords(toLat, toLng)
    );
    // Prefer a real driving route (with polyline geometry) when the Google
    // key is available; otherwise the haversine summary stands alone.
    const driving = await fetchDrivingRoute(
      normalizeCoords(fromLat, fromLng),
      normalizeCoords(toLat, toLng)
    );
    return res.json(driving ? { ...summary, ...driving } : summary);
  } catch (error) {
    return next(error);
  }
};

module.exports = { geocode, reverse, nearbyFundis, routePreview };
