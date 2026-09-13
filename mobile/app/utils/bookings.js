import { formatUgx } from './ratings';

export const BOOKING_STATUS_LABELS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  ON_THE_WAY: 'On the Way',
  ARRIVED: 'Arrived',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
};

export const CLIENT_BOOKING_STEPS = [
  { key: 'PENDING', label: 'Requested' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PRICE', label: 'Price Agreed' },
  { key: 'PAID', label: 'Paid' },
  { key: 'ON_THE_WAY', label: 'On Way' },
  { key: 'ARRIVED', label: 'Arrived' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Done' },
];

export const FUNDI_STATUS_ACTIONS = [
  { status: 'ON_THE_WAY', label: 'On the Way', icon: 'car-outline' },
  { status: 'ARRIVED', label: 'Arrived', icon: 'location-outline' },
  { status: 'IN_PROGRESS', label: 'In Progress', icon: 'construct-outline' },
  { status: 'COMPLETED', label: 'Completed', icon: 'checkmark-circle-outline' },
];

export const FUNDI_STATUS_TINT = {
  PENDING: { bg: 'rgba(59,130,246,0.10)', fg: '#3B82F6' },
  ACCEPTED: { bg: 'rgba(59,130,246,0.10)', fg: '#3B82F6' },
  ON_THE_WAY: { bg: 'rgba(255,184,0,0.14)', fg: '#B45309' },
  ARRIVED: { bg: 'rgba(139,92,246,0.12)', fg: '#7C3AED' },
  IN_PROGRESS: { bg: 'rgba(34,197,94,0.12)', fg: '#16A34A' },
  COMPLETED: { bg: 'rgba(34,197,94,0.12)', fg: '#16A34A' },
  CANCELLED: { bg: 'rgba(239,68,68,0.12)', fg: '#DC2626' },
  DISPUTED: { bg: 'rgba(239,68,68,0.12)', fg: '#DC2626' },
};

const CATEGORY_MAP = {
  plumber: 'Plumber',
  electrician: 'Electrician',
  carpenter: 'Carpenter',
  painter: 'Painter',
  plumbing: 'Plumber',
  electrical: 'Electrician',
};

export function normalizeCategory(service, skills = []) {
  if (skills.length) return skills[0];
  const key = String(service || '').trim().toLowerCase();
  return CATEGORY_MAP[key] || service || 'General';
}

export function formatCountdown(totalSeconds) {
  const secs = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function getTimeLeftSeconds(booking) {
  if (!booking?.expiresAt) return booking?.timeLeft ?? 0;
  const parsed = new Date(booking.expiresAt).getTime();
  if (isNaN(parsed)) return booking?.timeLeft ?? 0;
  const diff = parsed - Date.now();
  return Math.max(0, Math.floor(diff / 1000));
}

export function canProceedToPayment(booking) {
  return (
    booking?.status === 'ACCEPTED' &&
    booking?.priceAgreed === true &&
    !booking?.paid
  );
}

export function calculateDistanceKm(from, to) {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function mapApiBooking(booking, role = 'customer') {
  if (!booking) return null;
  const id = booking._id || booking.id;
  if (!id) return null;

  const fundi = booking.fundiId || {};
  const client = booking.clientId || {};
  const agreed = booking.agreedPrice || booking.proposedPrice || 0;
  // Platform revenue is the client-side fee only (5% default); trust the
  // value stored on the booking once the escrow hold exists.
  const platformFee =
    booking.clientFee != null ? booking.clientFee : Math.round(agreed * 0.05);
  const total = agreed + platformFee;
  // `location` stays a {lat,lng} object for geo math; anything rendered as
  // text must use the string `address`.
  const address =
    typeof booking.address === 'string'
      ? booking.address
      : '';

  return {
    id,
    _id: id,
    status: booking.status || 'PENDING',
    statusLabel: BOOKING_STATUS_LABELS[booking.status] || booking.status || 'Pending',
    category: booking.category || '',
    service: booking.category || '',
    description: booking.description || '',
    address,
    location: booking.location || null,
    expiresAt: booking.expiresAt || null,
    timeLeft: getTimeLeftSeconds(booking),
    fundiId: fundi?._id || booking.fundiId || null,
    fundiName: fundi?.name || booking.fundiName || 'Fundi',
    fundiPhone: fundi?.phone || null,
    clientId: client?._id || booking.clientId || null,
    clientName: client?.name || booking.clientName || 'Client',
    clientPhone: client?.phone || null,
    proposedPrice: booking.proposedPrice || null,
    proposedBy: booking.proposedBy || null,
    clientPriceAgreed: booking.clientPriceAgreed || false,
    fundiPriceAgreed: booking.fundiPriceAgreed || false,
    agreedPrice: booking.agreedPrice || null,
    priceAgreed: booking.priceAgreed || false,
    clientCompleted: Boolean(booking.clientCompleted),
    fundiCompleted: Boolean(booking.fundiCompleted),
    paymentStatus: booking.paymentStatus || 'unpaid',
    // Server truth: escrow hold or release means paid. The schema has no
    // boolean `paid` — never trust a local-only flag for this.
    paid:
      Boolean(booking.paid) ||
      ['held', 'released'].includes(booking.paymentStatus),
    fundiLocation: booking.fundiLocation || null,
    distanceKm: booking.distanceKm || null,
    amount: total,
    serviceFee: agreed,
    platformFee,
    total,
    createdAt: booking.createdAt || null,
    images: booking.images || [],
  };
}

export function mapBookingRequest(payload, fundiCoords) {
  if (!payload) return null;
  const distanceKm =
    payload.distanceKm ??
    calculateDistanceKm(fundiCoords, payload.location);

  return {
    id: payload.bookingId,
    bookingId: payload.bookingId,
    category: payload.category || '',
    service: payload.category || '',
    description: payload.description || '',
    address: payload.address || '',
    location: payload.location || null,
    clientName: payload.clientName || 'Client',
    clientPhone: payload.clientPhone || '',
    estimatedPrice: payload.estimatedPrice || null,
    expiresAt: payload.expiresAt || null,
    timeLeft: payload.timeLeft ?? getTimeLeftSeconds(payload),
    distanceKm,
    status: 'PENDING',
  };
}

export function bookingToActiveJob(booking) {
  const mapped = mapApiBooking(booking);
  if (!mapped) return null;
  return {
    id: mapped.id,
    bookingId: mapped.id,
    fundiId: mapped.fundiId,
    fundiName: mapped.fundiName,
    service: mapped.service,
    address: mapped.address,
    amount: mapped.total,
    status: (mapped.status || '').toLowerCase(),
    fundiLocation: mapped.fundiLocation,
  };
}

export function getBookingStepIndex(booking) {
  if (!booking) return 0;
  const status = booking.status || '';
  if (status === 'COMPLETED') return 7;
  if (status === 'IN_PROGRESS') return 6;
  if (status === 'ARRIVED') return 5;
  if (status === 'ON_THE_WAY') return 4;
  if (booking.paid) return 3;
  if (booking.priceAgreed) return 2;
  if (status === 'ACCEPTED') return 1;
  return 0;
}

export function priceSummaryText(booking) {
  if (!booking) return '';
  if (booking.priceAgreed && booking.agreedPrice) {
    return `Agreed price: ${formatUgx(booking.agreedPrice)}`;
  }
  if (booking.proposedPrice) {
    const by = booking.proposedBy === 'CLIENT' ? 'Client' : 'Fundi';
    return `${by} proposed ${formatUgx(booking.proposedPrice)}`;
  }
  return 'Agree on a service price to continue';
}

// Where should the client be taken for this booking right now?
// Resolved against fresh server state so a booking accepted while the
// client was away routes past the waiting screen automatically.
export function bookingRoute(booking) {
  if (!booking?.id && !booking?._id) return null;
  const status = String(booking.status || '').toUpperCase();
  switch (status) {
    case 'ON_THE_WAY':
    case 'ARRIVED':
      return { key: 'tracking', params: {} };
    case 'IN_PROGRESS':
      return {
        key: 'jobInProgress',
        params: { job: bookingToActiveJob(booking) },
      };
    default:
      // PENDING (waiting for fundi) and ACCEPTED (price negotiation)
      return { key: 'bookingWaiting', params: { booking } };
  }
}
