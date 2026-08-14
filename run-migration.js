const { Pool } = require('pg');
require('dotenv').config({ path: 'apps/user-web/.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS check_tx_type;
      ALTER TABLE public.ledger_entries ADD CONSTRAINT check_tx_type CHECK (tx_type IN (
          'DEPOSIT',
          'WITHDRAW',
          'SWAP_IN',
          'SWAP_OUT',
          'REFERRAL_BONUS',
          'FOSTER_BONUS',
          'MAMA_BONUS',
          'CHEOTAN_BONUS',
          'RANK_BONUS',
          'RANK_STAR_BONUS',
          'CHOITAN_BONUS',
          'PACKAGE_BUY',
          'PACKAGE_BONUS',
          'GAME_WAGER',
          'GAME_WIN'
      ));
    `);
    console.log('Migration applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
