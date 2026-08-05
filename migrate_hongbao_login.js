require('dotenv').config({ path: 'apps/admin/.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("Adding last_login_at to public.users...");
    await client.query(`
      ALTER TABLE public.users 
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
    `);

    console.log("Adding HONGBAO to public.assets...");
    // Insert if it doesn't exist
    await client.query(`
      INSERT INTO public.assets (symbol, contract_address, decimals, is_active)
      VALUES ('HONGBAO', NULL, 0, true)
      ON CONFLICT (symbol) DO NOTHING;
    `);

    // We also need to add BAO if it doesn't exist, though it seemed to be used in game-rounds
    await client.query(`
      INSERT INTO public.assets (symbol, contract_address, decimals, is_active)
      VALUES ('BAO', NULL, 18, true), ('JADE', NULL, 18, true)
      ON CONFLICT (symbol) DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("Migration successful!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", e);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
