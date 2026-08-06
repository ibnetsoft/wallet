import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(req: Request) {
  try {
    const { user_id, level, price, urdBonus, capRate } = await req.json();

    if (!user_id || !level || !price) {
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get Asset IDs
      const assetsRes = await client.query(`SELECT id, symbol FROM public.assets WHERE symbol IN ('USDT', 'JADE', 'URC')`);
      const assets = Object.fromEntries(assetsRes.rows.map(a => [a.symbol, a.id]));
      
      if (!assets.USDT || !assets.JADE) {
        throw new Error('System assets not fully configured (USDT or JADE missing)');
      }

      // 2. Deduct USDT
      const usdtBalRes = await client.query(
        `UPDATE public.user_balances SET available_balance = available_balance - $1, updated_at = NOW() 
         WHERE user_id = $2 AND asset_id = $3 AND available_balance >= $1 RETURNING available_balance`,
        [price, user_id, assets.USDT]
      );
      if (usdtBalRes.rows.length === 0) throw new Error('Insufficient USDT balance');

      // 3. Add JADE (옥구슬)
      await client.query(
        `INSERT INTO public.user_balances (user_id, asset_id, available_balance, updated_at) 
         VALUES ($1, $2, $3, NOW()) 
         ON CONFLICT (user_id, asset_id) 
         DO UPDATE SET available_balance = user_balances.available_balance + EXCLUDED.available_balance, updated_at = NOW()`,
        [user_id, assets.JADE, urdBonus]
      );

      // 4. Add URC (홍바오) if applicable based on level
      let urcBonus = 0;
      if (level === 2) urcBonus = 1;
      if (level === 3) urcBonus = 3;

      if (urcBonus > 0 && assets.URC) {
        await client.query(
          `INSERT INTO public.user_balances (user_id, asset_id, available_balance, updated_at) 
           VALUES ($1, $2, $3, NOW()) 
           ON CONFLICT (user_id, asset_id) 
           DO UPDATE SET available_balance = user_balances.available_balance + EXCLUDED.available_balance, updated_at = NOW()`,
          [user_id, assets.URC, urcBonus]
        );
      }

      // 5. Insert Ledger Entries
      // Deduct USDT
      await client.query(
        `INSERT INTO public.ledger_entries (user_id, asset_id, transaction_type, amount, status) 
         VALUES ($1, $2, 'PACKAGE_BUY', $3, 'COMPLETED')`,
        [user_id, assets.USDT, -price]
      );
      // Give JADE
      await client.query(
        `INSERT INTO public.ledger_entries (user_id, asset_id, transaction_type, amount, status) 
         VALUES ($1, $2, 'BONUS', $3, 'COMPLETED')`,
        [user_id, assets.JADE, urdBonus]
      );
      // Give URC
      if (urcBonus > 0 && assets.URC) {
        await client.query(
          `INSERT INTO public.ledger_entries (user_id, asset_id, transaction_type, amount, status) 
           VALUES ($1, $2, 'BONUS', $3, 'COMPLETED')`,
          [user_id, assets.URC, urcBonus]
        );
      }

      // 6. Insert User Game Machine
      const payoutCap = price * capRate;
      await client.query(
        `INSERT INTO public.user_game_machines (user_id, package_level, purchase_price, total_entry_limit, payout_limit_usd)
         VALUES ($1, $2, $3, $4, $5)`,
        [user_id, level, price, urdBonus, payoutCap]
      );

      await client.query('COMMIT');

      return NextResponse.json({ 
        success: true, 
        message: 'Package purchased successfully',
        balances: {
          USDT: usdtBalRes.rows[0].available_balance,
          JADE: urdBonus,
          URC: urcBonus
        }
      });
    } catch (e: any) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Purchase error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
