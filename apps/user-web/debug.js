const fs = require('fs');
const env = fs.readFileSync('d:/Projects/wallet/apps/user-web/.env.local', 'utf8');
const dbUrl = env.match(/DATABASE_URL="?([^"\r\n]+)"?/)[1];
const { Pool } = require('pg');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    const res = await pool.query(`SELECT b.available_balance, a.symbol, b.user_id FROM public.user_balances b JOIN public.assets a ON b.asset_id = a.id`);
    console.log("BALANCES:", res.rows);
    const res2 = await pool.query(`SELECT * FROM public.assets`);
    console.log("ASSETS:", res2.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
