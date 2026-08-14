import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.vyzmxxxhumldpppbmnvy:DldydghUSEBAY@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Querying system_settings rows...");
    const res = await client.query("SELECT * FROM public.system_settings");
    console.log("Rows in database:", res.rows);
  } catch (e) {
    console.error("Query failed:", e);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
