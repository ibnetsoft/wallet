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
    const client = await pool.connect();
    try {
      const [direct, sponsor, tickets] = await Promise.all([
        client.query(
          `SELECT id, nickname, email, status, referral_seq, accumulated_revenue
           FROM public.users
           WHERE recommender_id = $1
           ORDER BY referral_seq ASC, created_at ASC`,
          [user.id]
        ),
        client.query(
          `SELECT id, nickname, email, status, recommender_id, sponsor_id,
                  original_recommender_id, referral_seq, accumulated_revenue
           FROM public.users
           WHERE sponsor_id = $1
           ORDER BY created_at ASC`,
          [user.id]
        ),
        client.query(
          `SELECT COALESCE(SUM(cheotan_tickets), 0) AS total
           FROM public.user_game_machines
           WHERE user_id = $1`,
          [user.id]
        ),
      ]);
      return NextResponse.json({
        success: true,
        data: {
          directTree: direct.rows.map((row) => ({
            id: row.id,
            nickname: row.nickname || row.email,
            status: row.status,
            referralSeq: Number(row.referral_seq),
            totalPurchase: Number(row.accumulated_revenue),
            isRollup: Number(row.referral_seq) > 0 && Number(row.referral_seq) % 3 === 0,
          })),
          sponsorTree: sponsor.rows.map((row) => ({
            id: row.id,
            nickname: row.nickname || row.email,
            status: row.status,
            tier: 1,
            isRolledIn: Boolean(row.original_recommender_id && row.original_recommender_id !== row.recommender_id),
            originalRecommender: row.original_recommender_id ?? null,
            salesVolume: Number(row.accumulated_revenue),
          })),
          totalCheotanTickets: Number(tickets.rows[0]?.total ?? 0),
        },
      });
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error("Network query failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load network" }, { status: 500 });
  }
}
