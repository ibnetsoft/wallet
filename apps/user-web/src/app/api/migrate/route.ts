import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  try {
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
      return NextResponse.json({ success: true, message: 'Migration applied!' });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
