import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const res = await pool.query(
      `SELECT
         id,
         package_level,
         purchase_price,
         total_entry_limit,
         payout_limit_usd,
         accumulated_payout_usd,
         created_at
       FROM public.user_game_machines
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      machines: res.rows.map((row) => ({
        id: String(row.id),
        level: Number(row.package_level),
        price: parseFloat(row.purchase_price),
        urdBonus: Number(row.total_entry_limit ?? 0),
        payoutCap: parseFloat(row.payout_limit_usd),
        accumulatedPayout: parseFloat(row.accumulated_payout_usd ?? 0),
        purchasedAt: row.created_at,
      }))
    });
  } catch (err: any) {
    console.error("GET api/user/machines error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
