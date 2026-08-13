import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAuthenticatedUser } from "@/lib/current-user";

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
    const result = await pool.query(
      `SELECT p.id, r.round_number AS round, p.tickets_count AS "betsCount",
              p.tickets_count AS "urdSpent", p.status, p.created_at AS "betAt"
       FROM public.game_participants p
       JOIN public.game_rounds r ON r.id = p.round_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [user.id]
    );
    return NextResponse.json({
      success: true,
      bets: result.rows.map((row) => ({
        id: `b-${row.id}`,
        round: Number(row.round),
        betsCount: Number(row.betsCount),
        urdSpent: Number(row.urdSpent),
        status: row.status === "PENDING" ? "WAITING" : row.status,
        betAt: new Date(row.betAt).toLocaleTimeString("ko-KR", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    });
  } catch (error: unknown) {
    console.error("Bet query failed:", error);
    return NextResponse.json({ success: false, error: "Failed to load bets" }, { status: 500 });
  }
}
