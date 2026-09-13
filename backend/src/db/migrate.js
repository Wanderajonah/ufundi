require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

/**
 * Applies sql/schema.sql to the Supabase Postgres database. Idempotent:
 * safe to run repeatedly (uses "create table if not exists").
 *
 * Usage: npm run migrate
 */
async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL (Supabase Postgres connection string). Add it to .env");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const sqlPath = path.join(__dirname, "../../sql/schema.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  console.log("Applying schema to Supabase Postgres...");
  try {
    await pool.query(sql);
    console.log("Schema migrated successfully");
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});