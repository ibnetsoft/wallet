import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // JOIN query to get balance by symbol dynamically
    const res = await client.query(`
      SELECT b.available_balance, a.symbol 
      FROM public.user_balances b
      JOIN public.assets a ON b.asset_id = a.id
      WHERE b.user_id = $1
    `, [userId]);

    const balances: Record<string, number> = {
      USDT: 0,
      URC: 0,
      BNB: 0,
      JADE: 0
    };

    res.rows.forEach((row) => {
      if (row.symbol) {
        balances[row.symbol.toUpperCase()] = parseFloat(row.available_balance || "0");
      }
    });

    return NextResponse.json({ success: true, balances });
  } catch (err: any) {
    console.error("GET api/user/balance error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
