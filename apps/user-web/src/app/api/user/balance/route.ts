import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAuthenticatedUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  try {
    const res = await pool.query(
      `SELECT b.available_balance, a.symbol
       FROM public.user_balances b
       JOIN public.assets a ON a.id = b.asset_id
       WHERE b.user_id = $1`,
      [user.id]
    );
    const balances: Record<string, number> = { USDT: 0, URC: 0, BNB: 0, BAO: 0, JADE: 0, HONGBAO: 0 };
    for (const row of res.rows) {
      balances[String(row.symbol).toUpperCase()] = Number(row.available_balance);
    }
    return NextResponse.json({ success: true, balances });
  } catch (error: unknown) {
    console.error("Balance query failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load balances" }, { status: 500 });
  }
}
