import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(req: Request) {
  try {
    const { user_id, round_id, tickets_count } = await req.json();

    if (!user_id || !round_id || !tickets_count || tickets_count <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Check if round is open
      const roundRes = await client.query('SELECT status FROM public.game_rounds WHERE id = $1 FOR UPDATE', [round_id]);
      if (roundRes.rows.length === 0) throw new Error('Round not found');
      if (roundRes.rows[0].status !== 'OPEN') throw new Error('Round is not OPEN');

      // 2. Get Asset IDs
      const assetsRes = await client.query(`SELECT id, symbol FROM public.assets WHERE symbol IN ('USDT', 'JADE')`);
      const assets = Object.fromEntries(assetsRes.rows.map(a => [a.symbol, a.id]));
      if (!assets.USDT || !assets.JADE) throw new Error('System assets not fully configured (USDT or JADE missing)');

      const usdtRequired = 100 * tickets_count;
      const jadeRequired = 1 * tickets_count;

      // 3. Check & deduct USDT balance
      const usdtBalRes = await client.query(
        `UPDATE public.user_balances SET available_balance = available_balance - $1, updated_at = NOW() 
         WHERE user_id = $2 AND asset_id = $3 AND available_balance >= $1 RETURNING available_balance`,
        [usdtRequired, user_id, assets.USDT]
      );
      if (usdtBalRes.rows.length === 0) throw new Error('Insufficient USDT balance');

      // 4. Check & deduct JADE balance
      const jadeBalRes = await client.query(
        `UPDATE public.user_balances SET available_balance = available_balance - $1, updated_at = NOW() 
         WHERE user_id = $2 AND asset_id = $3 AND available_balance >= $1 RETURNING available_balance`,
        [jadeRequired, user_id, assets.JADE]
      );
      if (jadeBalRes.rows.length === 0) throw new Error('Insufficient Jade Beads (옥구슬)');

      // 5. Insert Ledger Entries
      await client.query(
        `INSERT INTO public.ledger_entries (user_id, asset_id, tx_type, amount, status) 
         VALUES ($1, $2, 'GAME_WAGER', $3, 'COMPLETED'), ($1, $4, 'GAME_WAGER', $5, 'COMPLETED')`,
        [user_id, assets.USDT, -usdtRequired, assets.JADE, -jadeRequired]
      );

      // 6. Upsert game_participants
      await client.query(`
        INSERT INTO public.game_participants (round_id, user_id, tickets_count, status)
        VALUES ($1, $2, $3, 'PENDING')
        ON CONFLICT (round_id, user_id) DO UPDATE SET 
          tickets_count = public.game_participants.tickets_count + EXCLUDED.tickets_count
      `, [round_id, user_id, tickets_count]);

      await client.query('COMMIT');
      return NextResponse.json({ success: true, message: 'Participation successful' });
    } catch (e: any) {
      await client.query('ROLLBACK');
      console.error('Participation error:', e);
      return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('API error:', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
