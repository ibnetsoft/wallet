import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      // 1. Get users with balances
      // Since it's a joined query, we write a SQL query to fetch what we need.
      const usersRes = await client.query(`
        SELECT 
          u.id, 
          u.email, 
          COALESCE(
            json_agg(json_build_object('address', uw.address)) FILTER (WHERE uw.address IS NOT NULL), 
            '[]'
          ) as user_wallets,
          COALESCE(
            json_agg(json_build_object('available_balance', ub.available_balance, 'asset_id', ub.asset_id)) FILTER (WHERE ub.asset_id IS NOT NULL), 
            '[]'
          ) as user_balances
        FROM public.users u
        LEFT JOIN public.user_wallets uw ON u.id = uw.user_id
        LEFT JOIN public.user_balances ub ON u.id = ub.user_id
        GROUP BY u.id, u.email
        LIMIT 100
      `);
      
      const usersWithBalances = usersRes.rows;

      // 2. Get system settings
      const settingsRes = await client.query("SELECT key, value FROM public.system_settings");
      const settings = settingsRes.rows;

      // 3. Get vault transfer logs
      const logsRes = await client.query("SELECT * FROM public.vault_transfers ORDER BY created_at DESC LIMIT 30");
      const logs = logsRes.rows;

      return NextResponse.json({
        success: true,
        usersWithBalances,
        settings,
        logs
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("wallet/status API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
