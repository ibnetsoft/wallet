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
      `SELECT l.id, l.amount, l.tx_type, l.status, l.tx_hash, l.details, l.created_at, a.symbol
       FROM public.ledger_entries l
       LEFT JOIN public.assets a ON a.id = l.asset_id
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC
       LIMIT 100`,
      [user.id]
    );
    return NextResponse.json({
      success: true,
      entries: res.rows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        txType: row.tx_type,
        status: row.status,
        txHash: row.tx_hash,
        symbol: row.symbol ?? "USDT",
        details: typeof row.details === "string" ? JSON.parse(row.details) : row.details,
        createdAt: row.created_at,
      })),
    });
  } catch (error: unknown) {
    console.error("History query failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load history" }, { status: 500 });
  }
}
