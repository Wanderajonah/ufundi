const { haversineDistanceKm, normalizeCoords } = require("../utils/geo");

const GOOGLE_BASE = "https://maps.googleapis.com/maps/api";

const getApiKey = () => process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_SERVER_KEY;

const extractAddressParts = (result) => {
  const find = (type) =>
    result.address_components?.find((c) => c.types?.includes(type))?.long_name || "";
  return {
    district:
      find("administrative_area_level_2") ||
      find("locality") ||
      find("sublocality") ||
      find("administrative_area_level_1"),
    country: find("country")
  };
};

const enrichGeocodeResult = (r, coords) => {
  const parts = extractAddressParts(r);
  return {
    formattedAddress: r.formatted_address,
    address: r.formatted_address,
    lat: coords.lat,
    lng: coords.lng,
    district: parts.district,
    country: parts.country,
    placeId: r.place_id,
    source: "google"
  };
};
const kampalaFallback = (lat, lng) => ({
  formattedAddress: "Kampala, Uganda",
  address: "Kampala, Uganda",
  district: "Kampala",
  country: "Uganda",
  lat: Number(lat) || -1.286389,
  lng: Number(lng) || 36.817223,
  placeId: null,
  source: "fallback"
});

const geocodeAddress = async (address) => {
  const key = getApiKey();
  if (!key) {
    return { ...kampalaFallback(), query: address, source: "fallback-no-key" };
  }

  const url = `${GOOGLE_BASE}/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.[0]) {
    const err = new Error(data.error_message || "Address not found");
    err.statusCode = 404;
    throw err;
  }

  const r = data.results[0];
  return {
    formattedAddress: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    placeId: r.place_id,
    source: "google"
  };
};

const reverseGeocode = async (lat, lng) => {
  const coords = normalizeCoords(lat, lng);
  const key = getApiKey();

  if (!key) {
    return kampalaFallback(coords.lat, coords.lng);
  }

  const url = `${GOOGLE_BASE}/geocode/json?latlng=${coords.lat},${coords.lng}&key=${key}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "OK" || !data.results?.[0]) {
    return kampalaFallback(coords.lat, coords.lng);
  }

  const r = data.results[0];
  return enrichGeocodeResult(r, coords);
};

/** ETA in minutes from distance (rough urban speed ~25 km/h) */
const estimateEtaMinutes = (distanceKm) => Math.max(3, Math.round((distanceKm / 25) * 60));

/** Strip HTML from a Directions API instruction (e.g. "<b>Head north</b> on X"). */
const cleanInstruction = (html) =>
  String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** Decode a Google encoded polyline into [{lat,lng}] points. */
const decodePolyline = (encoded) => {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 1;
    let shift = 0;
    let b;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 1;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return points;
};

/**
 * Driving route from the Google Directions API. Returns null when no key is
 * configured or the API fails so callers can fall back to haversine summary.
 */
const fetchDrivingRoute = async (from, to) => {
  const key = getApiKey();
  if (!key) return null;

  try {
    const url =
      `${GOOGLE_BASE}/directions/json?origin=${from.lat},${from.lng}` +
      `&destination=${to.lat},${to.lng}&mode=driving&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const leg = route.legs?.[0];
    const distanceKm =
      leg?.distance?.value != null
        ? Number((leg.distance.value / 1000).toFixed(2))
        : Number(haversineDistanceKm(from, to).toFixed(2));
    const etaMinutes =
      leg?.duration?.value != null
        ? Math.max(1, Math.round(leg.duration.value / 60))
        : estimateEtaMinutes(distanceKm);

    const polyline = route.overview_polyline?.points
      ? decodePolyline(route.overview_polyline.points)
      : [];

    const steps = (leg?.steps || []).map((step) => ({
      instruction: cleanInstruction(step.html_instructions),
      maneuver: step.maneuver || null,
      distanceMeters: step.distance?.value ?? null,
      durationSeconds: step.duration?.value ?? null,
      start: step.start_location
        ? { lat: step.start_location.lat, lng: step.start_location.lng }
        : null,
      end: step.end_location
        ? { lat: step.end_location.lat, lng: step.end_location.lng }
        : null,
    }));

    return {
      distanceKm,
      etaMinutes,
      polyline,
      steps,
      source: "google-directions",
    };
  } catch {
    return null;
  }
};

const buildRouteSummary = (from, to) => {
  const distanceKm = Number(haversineDistanceKm(from, to).toFixed(2));
  return {
    distanceKm,
    etaMinutes: estimateEtaMinutes(distanceKm)
  };
};

module.exports = {
  geocodeAddress,
  reverseGeocode,
  buildRouteSummary,
  fetchDrivingRoute,
  normalizeCoords
};
