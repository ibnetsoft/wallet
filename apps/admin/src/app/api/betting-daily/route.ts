import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BET_AMOUNT_PER_TICKET_USDT = 100;

export async function GET(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedDays = Number.parseInt(searchParams.get("days") || "30", 10);
    const days = Number.isFinite(requestedDays)
      ? Math.min(Math.max(requestedDays, 1), 365)
      : 30;

    const result = await pool.query<{
      bet_date: string;
      total_tickets: string | number;
      total_bet_amount: string | number;
      participants_count: string | number;
      rounds_count: string | number;
    }>(
      `SELECT
         gp.round_date::text AS bet_date,
         COALESCE(SUM(gp.tickets_count), 0) AS total_tickets,
         COALESCE(SUM(gp.tickets_count * $1), 0) AS total_bet_amount,
         COUNT(DISTINCT gp.user_id) AS participants_count,
         COUNT(DISTINCT gp.round_id) AS rounds_count
       FROM public.game_participants AS gp
       WHERE gp.round_date >= ((now() AT TIME ZONE 'Asia/Shanghai')::date - ($2::int - 1))
         AND gp.status <> 'REFUNDED'
       GROUP BY gp.round_date
       ORDER BY gp.round_date DESC`,
      [BET_AMOUNT_PER_TICKET_USDT, days]
    );

    const dailyTotals = result.rows.map((row) => ({
      date: row.bet_date,
      totalTickets: Number(row.total_tickets),
      totalBetAmount: Number(row.total_bet_amount),
      participantsCount: Number(row.participants_count),
      roundsCount: Number(row.rounds_count),
    }));

    const summary = dailyTotals.reduce(
      (acc, row) => {
        acc.totalBetAmount += row.totalBetAmount;
        acc.totalTickets += row.totalTickets;
        acc.totalParticipants += row.participantsCount;
        if (!acc.peakDay || row.totalBetAmount > acc.peakDay.totalBetAmount) {
          acc.peakDay = row;
        }
        return acc;
      },
      {
        totalBetAmount: 0,
        totalTickets: 0,
        totalParticipants: 0,
        peakDay: null as null | (typeof dailyTotals)[number],
      }
    );

    return NextResponse.json({
      success: true,
      days,
      unitBetAmount: BET_AMOUNT_PER_TICKET_USDT,
      dailyTotals,
      summary: {
        totalBetAmount: summary.totalBetAmount,
        totalTickets: summary.totalTickets,
        totalParticipants: summary.totalParticipants,
        daysWithData: dailyTotals.length,
        averageDailyBetAmount: dailyTotals.length > 0 ? summary.totalBetAmount / dailyTotals.length : 0,
        peakDay: summary.peakDay,
      },
    });
  } catch (error: unknown) {
    console.error("GET api/betting-daily error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to load daily betting totals.",
      },
      { status: 500 }
    );
  }
}
