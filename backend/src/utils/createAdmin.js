require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");

const createAdmin = async () => {
  await connectDB();

  const name = process.env.ADMIN_NAME || "Ufundi Admin";
  const email = (process.env.ADMIN_EMAIL || "admin@ufundi.ug").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "password123";

  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = await User.findOneAndUpdate(
    { email },
    {
      name,
      firstName: name.split(" ")[0] || "Ufundi",
      lastName: name.split(" ").slice(1).join(" ") || "Admin",
      email,
      password: hashedPassword,
      role: "admin",
      phoneVerified: true,
      onboardingComplete: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).select("-password");

  console.log("Admin user ready");
  console.log(`Email: ${admin.email}`);
  console.log(`Name: ${admin.name}`);
};

createAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
