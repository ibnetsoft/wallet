import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// GET /api/user/history?userId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const res = await pool.query(`
      SELECT 
        l.id,
        l.amount,
        l.tx_type,
        l.status,
        l.tx_hash,
        l.details,
        l.created_at,
        a.symbol
      FROM public.ledger_entries l
      LEFT JOIN public.assets a ON l.asset_id = a.id
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
      LIMIT 100
    `, [userId]);

    return NextResponse.json({
      success: true,
      entries: res.rows.map((r: any) => ({
        id: r.id,
        amount: parseFloat(r.amount),
        txType: r.tx_type,
        status: r.status,
        txHash: r.tx_hash,
        symbol: r.symbol || "USDT",
        details: typeof r.details === "string" ? JSON.parse(r.details) : r.details,
        createdAt: r.created_at
      }))
    });

  } catch (err: any) {
    console.error("GET /api/user/history error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
