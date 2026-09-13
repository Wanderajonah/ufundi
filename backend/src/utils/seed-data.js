require("dotenv").config();
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const connectDB = require("../config/db");
const User = require("../models/User");
const FundiProfile = require("../models/FundiProfile");
const Job = require("../models/Job");
const Booking = require("../models/Booking");
const Review = require("../models/Review");
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const PlatformSettings = require("../models/PlatformSettings");
const AdminNotification = require("../models/AdminNotification");

const CATEGORIES = [
  "plumbing", "electrical", "carpentry", "masonry", "painting",
  "cleaning", "mechanical", "welding", "gardening", "tiling"
];

const FIRST_NAMES = ["James", "Mary", "John", "Sarah", "Peter", "Esther", "David", "Grace", "Samuel", "Ruth",
  "Joseph", "Deborah", "Daniel", "Martha", "Isaac", "Rebecca", "Simon", "Agnes", "Paul", "Naomi",
  "Brian", "Joy", "Kevin", "Faith", "Musa", "Alice", "Ivan", "Sophia", "Patrick", "Doreen",
  "Alex", "Maria", "Robert", "Cynthia", "Tony", "Gladys", "Edward", "Lydia", "Frank", "Priscilla"];
const LAST_NAMES = ["Mukasa", "Nakato", "Ssali", "Nambi", "Kintu", "Nakibuule", "Wasswa", "Nalule", "Kato", "Nansubuga",
  "Ochieng", "Akello", "Okello", "Namuddu", "Byaruhanga", "Achieng", "Ssemanda", "Nanyonjo", "Opio", "Ndagire"];

const FUNDI_SKILLS = {
  plumbing: ["plumbing", "pipe fitting", "water heater installation"],
  electrical: ["electrical", "wiring", "lighting installation"],
  carpentry: ["carpentry", "furniture making", "cabinet installation"],
  masonry: ["masonry", "bricklaying", "concrete work"],
  painting: ["painting", "wall finishing", "decorative painting"],
  cleaning: ["cleaning", "deep cleaning", "sanitization"],
  mechanical: ["mechanical", "engine repair", "auto maintenance"],
  welding: ["welding", "metal fabrication", "gate installation"],
  gardening: ["gardening", "landscaping", "lawn mowing"],
  tiling: ["tiling", "floor installation", "wall tiling"],
};

const DISTRICTS = ["Kampala", "Wakiso", "Entebbe", "Mukono", "Jinja"];
const STREETS = ["Main St", "Market Rd", "Hill Ave", "Lake Dr", "Park Ln"];

const REVIEW_COMMENTS = [
  "Excellent work!",
  "Very professional",
  "Great job",
  "Good service",
  "Would recommend",
  "On time and quality work",
  "Fair price, good quality",
  "Satisfied with the service",
  "Neat and tidy workmanship",
  "Arrived early and finished fast",
  "Very skilled and friendly",
  "Clean work, great results",
];

const BOOKING_DESCRIPTIONS = {
  plumbing: ["Fix leaking kitchen sink", "Replace bathroom tap", "Unblock toilet drain", "Install water heater", "Repair burst water pipe"],
  electrical: ["Install ceiling lights", "Fix electrical short circuit", "Rewire living room sockets", "Install security floodlight", "Replace faulty circuit breaker"],
  carpentry: ["Build custom wardrobe", "Repair wooden door", "Install kitchen cabinets", "Fix broken chair", "Build wooden bookshelf"],
  masonry: ["Repair cracked wall", "Build boundary wall", "Plaster bedroom wall", "Repair floor grout", "Construct concrete slab"],
  painting: ["Paint living room walls", "Repaint bedroom interior", "Waterproof exterior wall", "Paint office space", "Decorative wall finishing"],
  cleaning: ["Deep clean office premises", "Home sanitization", "Post-renovation clean-up", "Carpet and sofa shampoo", "Window and floor cleaning"],
  mechanical: ["Car engine service", "Fix car brake system", "Auto electrical repair", "Vehicle suspension check", "Engine oil change"],
  welding: ["Weld metal gate", "Fabricate steel window grilles", "Repair broken metal railing", "Build metal shelf", "Weld water tank stand"],
  gardening: ["Mow lawn and trim hedges", "Landscape backyard garden", "Plant flower beds", "Tree pruning", "Garden cleanup and weeding"],
  tiling: ["Install floor tiles", "Tile bathroom walls", "Fix loose tiles", "Grout kitchen tiles", "Waterproof bathroom tiling"],
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// Bias user signups toward recent months so the analytics growth chart trends upward.
function weightedDaysAgo() {
  const roll = Math.random();
  if (roll < 0.45) return randomInt(1, 40);
  if (roll < 0.75) return randomInt(41, 100);
  if (roll < 0.92) return randomInt(101, 150);
  return randomInt(151, 180);
}

// Weighted random pick for status distributions.
function weightedStatus(values, weights) {
  const roll = Math.random();
  let cum = 0;
  for (let j = 0; j < weights.length; j++) {
    cum += weights[j];
    if (roll <= cum) return values[j];
  }
  return values[values.length - 1];
}

const seed = async () => {
  await connectDB();

  // Clear existing data (keep admin users)
  await Promise.all([
    User.deleteMany({ role: { $ne: "admin" } }),
    FundiProfile.deleteMany({}),
    Job.deleteMany({}),
    Booking.deleteMany({}),
    Review.deleteMany({}),
    Transaction.deleteMany({}),
    Wallet.deleteMany({}),
    AdminNotification.deleteMany({}),
  ]);

  const password = await bcrypt.hash("password123", 10);
  const ObjectId = () => randomUUID();

  // === CUSTOMERS (50) ===
  const customers = [];
  for (let i = 0; i < 50; i++) {
    customers.push({
      _id: ObjectId(),
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      email: `customer${i}@example.com`,
      phone: `256700${100010 + i}`,
      password,
      role: "customer",
      phoneVerified: true,
      district: pick(DISTRICTS),
      createdAt: daysAgo(weightedDaysAgo()),
    });
  }
  await User.insertMany(customers);
  const customerIds = customers.map((c) => c._id);

  // === FUNDIS (40) ===
  const fundis = [];
  for (let i = 0; i < 40; i++) {
    const category = pick(CATEGORIES);
    const createdAt = daysAgo(weightedDaysAgo());
    const statusRoll = Math.random();
    const verificationStatus = statusRoll < 0.6 ? "verified" : statusRoll < 0.85 ? "pending" : "rejected";
    fundis.push({
      _id: ObjectId(),
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      email: `fundi${i}@fundi.com`,
      phone: `256700${200010 + i}`,
      password,
      role: "fundi",
      phoneVerified: true,
      district: pick(DISTRICTS),
      createdAt,
      _meta: { category, verificationStatus, createdAt },
    });
  }
  await User.insertMany(fundis);

  // === FUNDI PROFILES ===
  const profiles = fundis.map((f) => ({
    userId: f._id,
    skills: FUNDI_SKILLS[f._meta.category] || [f._meta.category],
    experience: randomInt(1, 15),
    rating: Number((3.5 + Math.random() * 1.5).toFixed(1)),
    verified: f._meta.verificationStatus === "verified",
    verificationStatus: f._meta.verificationStatus,
    requestedAt: f._meta.createdAt,
    reviewedAt: f._meta.verificationStatus !== "pending" ? daysAgo(randomInt(0, 5)) : null,
    isAvailable: true,
  }));
  await FundiProfile.insertMany(profiles);

  // === WALLETS ===
  const wallets = [
    ...fundis.map((f) => ({
      userId: f._id,
      balance: randomInt(10000, 200000),
      heldBalance: randomInt(0, 50000),
      currency: "UGX",
    })),
    ...customers.map((c) => ({
      userId: c._id,
      balance: randomInt(50000, 500000),
      heldBalance: 0,
      currency: "UGX",
    })),
  ];
  await Wallet.insertMany(wallets);

  // === JOBS (130) ===
  const jobStatuses = ["open", "quoted", "accepted", "in_progress", "completed", "cancelled"];
  const jobWeights = [0.1, 0.1, 0.1, 0.1, 0.45, 0.15];
  const jobs = [];
  for (let i = 0; i < 130; i++) {
    const category = pick(CATEGORIES);
    const customerId = pick(customerIds);
    const status = weightedStatus(jobStatuses, jobWeights);
    jobs.push({
      _id: ObjectId(),
      customerId,
      fundiId: status !== "open" ? pick(fundis)._id : undefined,
      description: pick(BOOKING_DESCRIPTIONS[category] || [category]),
      category,
      location: { lat: -1.28 + Math.random() * 0.04, lng: 36.81 + Math.random() * 0.04 },
      quoteAmount: randomInt(30000, 200000),
      status,
      address: `${randomInt(1, 100)} ${pick(STREETS)}`,
      amount: randomInt(30000, 200000),
      createdAt: daysAgo(randomInt(1, 180)),
    });
  }
  await Job.insertMany(jobs);

  // === BOOKINGS (50 in the last 7 days for weekly trend) ===
  const bookingStatuses = ["PENDING", "ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DISPUTED"];
  const bookingWeights = [0.05, 0.05, 0.05, 0.05, 0.1, 0.5, 0.1, 0.1];
  const paymentStatusMap = {
    COMPLETED: "released",
    DISPUTED: "held",
    CANCELLED: "refunded",
  };
  const bookings = [];
  for (let i = 0; i < 50; i++) {
    const daysBack = randomInt(0, 6);
    const bDate = daysAgo(daysBack);
    bDate.setHours(randomInt(6, 22), randomInt(0, 59));

    const status = weightedStatus(bookingStatuses, bookingWeights);
    const category = pick(CATEGORIES);
    const fundi = pick(fundis);
    const price = randomInt(30000, 250000);
    const payStatus = paymentStatusMap[status] || (Math.random() > 0.5 ? "held" : "unpaid");

    bookings.push({
      _id: ObjectId(),
      clientId: pick(customerIds),
      fundiId: fundi._id,
      category,
      description: pick(BOOKING_DESCRIPTIONS[category] || [category]),
      address: `${randomInt(1, 100)} ${pick(STREETS)}`,
      location: { lat: -1.28 + Math.random() * 0.04, lng: 36.81 + Math.random() * 0.04 },
      status,
      proposedPrice: price,
      agreedPrice: status !== "PENDING" && status !== "CANCELLED" ? price : null,
      priceAgreed: status !== "PENDING",
      paymentStatus: payStatus,
      escrowHeldAt: payStatus === "held" || payStatus === "released" ? bDate : null,
      escrowReleasedAt: payStatus === "released" ? new Date(bDate.getTime() + 3600000) : null,
      createdAt: bDate,
    });
  }
  await Booking.insertMany(bookings);

  // === TRANSACTIONS (100 in the last 7 days) ===
  const txTypes = ["escrow_hold", "escrow_release", "escrow_refund", "platform_fee", "payment_received", "deposit", "withdrawal"];
  const txWeights = [0.2, 0.2, 0.05, 0.2, 0.15, 0.1, 0.1];
  const transactions = [];
  for (let i = 0; i < 100; i++) {
    const txType = weightedStatus(txTypes, txWeights);
    const fundi = pick(fundis);
    const isFundiTx = ["escrow_release", "platform_fee", "payment_received"].includes(txType);
    const userId = isFundiTx ? fundi._id : pick(customerIds);
    const amount = txType === "platform_fee"
      ? randomInt(3000, 20000)
      : txType === "escrow_refund"
      ? randomInt(30000, 100000)
      : randomInt(30000, 250000);

    transactions.push({
      _id: ObjectId(),
      walletId: userId,
      userId,
      type: txType,
      amount,
      currency: "UGX",
      status: "completed",
      description: txType.replace(/_/g, " "),
      createdAt: daysAgo(randomInt(0, 6)),
    });
  }
  await Transaction.insertMany(transactions);

  // === REVIEWS (from completed jobs, up to 30) ===
  const reviewJobs = jobs.filter((j) => j.status === "completed" && j.fundiId).slice(0, 30);
  const reviews = reviewJobs.map((job) => ({
    _id: ObjectId(),
    fundiId: job.fundiId,
    customerId: job.customerId,
    jobId: job._id,
    rating: randomInt(3, 5),
    comment: pick(REVIEW_COMMENTS),
    createdAt: daysAgo(randomInt(1, 90)),
  }));
  await Review.insertMany(reviews);

  // === PLATFORM SETTINGS ===
  await PlatformSettings.findOneAndUpdate(
    {},
    {
      adminName: "FundiLink Admin",
      adminEmail: "admin@fundilink.ug",
      commissionRate: 10,
      minJobAmount: 10000,
      serviceRadius: 20,
      notifications: { push: true, sms: true, email: false },
      paymentIntegrations: { airtel: true, mtn: true, card: false },
    },
    { upsert: true }
  );

  console.log("Seed complete:");
  console.log(`  - 50 customers`);
  console.log(`  - 40 fundis`);
  console.log(`  - 130 jobs`);
  console.log(`  - 50 bookings`);
  console.log(`  - 100 transactions`);
  console.log(`  - ${reviews.length} reviews`);
};

module.exports = seed;

if (require.main === module) {
  seed().then(() => { console.log("Done"); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); });
}
