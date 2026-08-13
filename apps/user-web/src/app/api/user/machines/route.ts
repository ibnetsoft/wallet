import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAuthenticatedUser } from "@/lib/current-user";
import { getProduct } from "@/lib/products";

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
      `SELECT id, package_level, purchase_price, total_entry_limit, used_entries,
              payout_limit_usd, accumulated_payout_usd, created_at
       FROM public.user_game_machines
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC`,
      [user.id]
    );
    return NextResponse.json({
      success: true,
      machines: res.rows.map((row) => {
        const product = getProduct(row.package_level);
        const entryLimit = Number(row.total_entry_limit);
        const usedEntries = Number(row.used_entries);
        return {
          id: String(row.id),
          level: Number(row.package_level),
          price: Number(row.purchase_price),
          urdBonus: product?.jadeBonus ?? 0,
          entryLimit,
          usedEntries,
          remainingEntries: Math.max(entryLimit - usedEntries, 0),
          payoutCap: Number(row.payout_limit_usd),
          accumulatedPayout: Number(row.accumulated_payout_usd),
          purchasedAt: row.created_at,
        };
      }),
    });
  } catch (error: unknown) {
    console.error("Machine query failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load game machines" }, { status: 500 });
  }
}
