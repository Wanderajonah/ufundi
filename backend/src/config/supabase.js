const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

const supabaseUrl = () => process.env.SUPABASE_URL || "";
const serviceRoleKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// The server always talks through the service role key so Row Level Security
// policies never block backend access. Direct browser/admin clients would use
// the anon key instead; the backend is the only data consumer today.
const isConfigured = () => Boolean(supabaseUrl() && serviceRoleKey());

let client = null;
function getSupabase() {
  if (!isConfigured()) {
    const err = new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
    err.statusCode = 503;
    throw err;
  }
  if (!client) {
    client = createClient(supabaseUrl(), serviceRoleKey(), {
      auth: { persistSession: false },
      // Node < 22 has no native WebSocket; supply one (ws is already a
      // socket.io dependency). The app never subscribes to realtime channels.
      realtime: { transport: WebSocket },
    });
  }
  return client;
}

// Throw any configured Supabase misconfiguration that would otherwise surface
// as a confusing 500 far into the request lifecycle.
function assertConfigured() {
  return getSupabase();
}

module.exports = { getSupabase, isConfigured, assertConfigured, supabaseUrl };