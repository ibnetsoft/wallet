import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(request: Request) {
  try {
    const { address } = await request.json();
    if (!address) {
      return NextResponse.json({ success: false, error: "address is required" }, { status: 400 });
    }

    // 1. Save master_hot_wallet to system_settings
    await pool.query(`
      INSERT INTO public.system_settings (key, value)
      VALUES ('master_hot_wallet', $1)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [address]);

    // 2. Initialize hot_balance_usdt if not already set
    const checkBalance = await pool.query("SELECT * FROM public.system_settings WHERE key = 'hot_balance_usdt'");
    if (checkBalance.rows.length === 0) {
      await pool.query(`
        INSERT INTO public.system_settings (key, value)
        VALUES ('hot_balance_usdt', '0')
      `);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("wallet/setup route error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
