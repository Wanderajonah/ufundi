const { isConfigured } = require("./supabase");

// Database readiness check. Supabase connections are stateless (PostgREST over
// HTTPS), so unlike the old Mongoose driver there is nothing to connect eagerly;
// individual queries fail fast if the client is not configured.
const connectDB = async () => {
  if (!isConfigured()) {
    console.error("Supabase configuration error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
    process.exit(1);
  }
  console.log("Supabase client configured and ready");
};

module.exports = connectDB;