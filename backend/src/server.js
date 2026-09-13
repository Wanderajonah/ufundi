require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http");
const path = require("path");
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorHandler");
const initializeSocket = require("./config/socket");

const authRoutes = require("./routes/authRoutes");
const googleAuthRoutes = require("./routes/googleAuthRoutes");
const userRoutes = require("./routes/userRoutes");
const fundiRoutes = require("./routes/fundiRoutes");
const jobRoutes = require("./routes/jobRoutes");
const aiRoutes = require("./routes/aiRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const mapsRoutes = require("./routes/mapsRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const chatRoutes = require("./routes/chatRoutes");
const walletRoutes = require("./routes/walletRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { streamGridFsFile, ensureStorageBuckets } = require("./services/gridfsStorage");

const app = express();

console.log("Upload storage: Supabase Storage");

connectDB().then(async () => {
  await ensureStorageBuckets();
  const bcrypt = require("bcryptjs");
  const User = require("./models/User");
  const name = process.env.ADMIN_NAME || "FundiLink Admin";
  const email = (process.env.ADMIN_EMAIL || "admin@fundilink.ug").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "password123";
  User.findOneAndUpdate(
    { email },
    { name, email, password: bcrypt.hashSync(password, 10), role: "admin", phoneVerified: true, onboardingComplete: true },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).then(() => console.log("Admin user ready")).catch((err) => console.error("Admin creation error:", err));
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

// Serve static files from uploads directory. New uploads live in Supabase
// Storage (public URLs); disk is kept as a fallback for legacy files.
app.use("/uploads/:subdir/:fileId", streamGridFsFile);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api/health", (req, res) => {
  const { isConfigured } = require("./services/supportBotService");
  res.json({
    status: "ok",
    service: "FundiLink API",
    features: {
      auth: true,
      otp: true,
      maps: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      ai: true,
      aiVision: isConfigured(),
      bookings: true,
      chat: true,
      socket: true,
      wallet: true
    }
  });
});

app.get("/api/platform-settings", async (req, res, next) => {
  try {
    const PlatformSettings = require("./models/PlatformSettings");
    let settings = await PlatformSettings.findOne();
    if (!settings) {
      settings = await PlatformSettings.create({});
    }
    res.json({
      commissionRate: settings.commissionRate,
      clientFeeRate: settings.clientFeeRate,
      minJobAmount: settings.minJobAmount,
      serviceRadius: settings.serviceRadius,
      currency: "UGX",
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/auth", googleAuthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/fundis", fundiRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/maps", mapsRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Create HTTP server for Socket.io
const server = http.createServer(app);

// Initialize Socket.io
initializeSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io server initialized`);
  console.log(`Accessible at http://192.168.42.4:${PORT}`);
});
