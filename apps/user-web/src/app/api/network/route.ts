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
          `SELECT u.id, u.nickname, u.email, u.status, u.referral_seq,
                  COALESCE(machine_totals.total_purchase, 0) AS total_purchase
           FROM public.users u
           LEFT JOIN LATERAL (
             SELECT SUM(purchase_price) AS total_purchase
             FROM public.user_game_machines
             WHERE user_id = u.id
           ) AS machine_totals ON TRUE
           WHERE u.recommender_id = $1
           ORDER BY u.referral_seq ASC, u.created_at ASC`,
          [user.id]
        ),
        client.query(
          `SELECT u.id, u.nickname, u.email, u.status, u.recommender_id, u.sponsor_id,
                  u.original_recommender_id, u.referral_seq,
                  COALESCE(machine_totals.total_purchase, 0) AS total_purchase
           FROM public.users u
           LEFT JOIN LATERAL (
             SELECT SUM(purchase_price) AS total_purchase
             FROM public.user_game_machines
             WHERE user_id = u.id
           ) AS machine_totals ON TRUE
           WHERE u.sponsor_id = $1
           ORDER BY u.created_at ASC`,
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
            totalPurchase: Number(row.total_purchase),
            isRollup: Number(row.referral_seq) > 0 && Number(row.referral_seq) % 3 === 0,
          })),
          sponsorTree: sponsor.rows.map((row) => ({
            id: row.id,
            nickname: row.nickname || row.email,
            status: row.status,
            tier: 1,
            isRolledIn: Boolean(row.original_recommender_id && row.original_recommender_id !== row.recommender_id),
            originalRecommender: row.original_recommender_id ?? null,
            salesVolume: Number(row.total_purchase),
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
