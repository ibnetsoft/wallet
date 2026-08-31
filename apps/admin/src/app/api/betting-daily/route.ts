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

    const bettingResult = await pool.query<{
      bet_date: string;
      total_bet_amount: string | number;
    }>(
      `SELECT
         gp.round_date::text AS bet_date,
         COALESCE(SUM(gp.tickets_count * $1), 0) AS total_bet_amount
       FROM public.game_participants AS gp
       WHERE gp.round_date >= ((now() AT TIME ZONE 'Asia/Shanghai')::date - ($2::int - 1))
         AND gp.status <> 'REFUNDED'
       GROUP BY gp.round_date
       ORDER BY gp.round_date DESC`,
      [BET_AMOUNT_PER_TICKET_USDT, days]
    );

    const purchaseResult = await pool.query<{
      purchase_date: string;
      total_product_purchase_amount: string | number;
    }>(
      `SELECT
         ((ugm.created_at AT TIME ZONE 'Asia/Shanghai')::date)::text AS purchase_date,
         COALESCE(SUM(ugm.purchase_price), 0) AS total_product_purchase_amount
       FROM public.user_game_machines AS ugm
       WHERE (ugm.created_at AT TIME ZONE 'Asia/Shanghai')::date >= ((now() AT TIME ZONE 'Asia/Shanghai')::date - ($1::int - 1))
       GROUP BY (ugm.created_at AT TIME ZONE 'Asia/Shanghai')::date
       ORDER BY (ugm.created_at AT TIME ZONE 'Asia/Shanghai')::date DESC`,
      [days]
    );

    const dailyTotalsMap = new Map<string, {
      date: string;
      totalProductPurchaseAmount: number;
      totalBetAmount: number;
    }>();

    for (const row of purchaseResult.rows) {
      dailyTotalsMap.set(row.purchase_date, {
        date: row.purchase_date,
        totalProductPurchaseAmount: Number(row.total_product_purchase_amount),
        totalBetAmount: 0,
      });
    }

    for (const row of bettingResult.rows) {
      const existing = dailyTotalsMap.get(row.bet_date);
      if (existing) {
        existing.totalBetAmount = Number(row.total_bet_amount);
        continue;
      }

      dailyTotalsMap.set(row.bet_date, {
        date: row.bet_date,
        totalProductPurchaseAmount: 0,
        totalBetAmount: Number(row.total_bet_amount),
      });
    }

    const dailyTotals = [...dailyTotalsMap.values()].sort((a, b) => b.date.localeCompare(a.date));

    const summary = dailyTotals.reduce(
      (acc, row) => {
        acc.totalProductPurchaseAmount += row.totalProductPurchaseAmount;
        acc.totalBetAmount += row.totalBetAmount;
        acc.totalCombinedAmount += row.totalProductPurchaseAmount + row.totalBetAmount;
        if (!acc.peakDay || (row.totalProductPurchaseAmount + row.totalBetAmount) > (acc.peakDay.totalProductPurchaseAmount + acc.peakDay.totalBetAmount)) {
          acc.peakDay = row;
        }
        return acc;
      },
      {
        totalProductPurchaseAmount: 0,
        totalBetAmount: 0,
        totalCombinedAmount: 0,
        peakDay: null as null | (typeof dailyTotals)[number],
      }
    );

    return NextResponse.json({
      success: true,
      days,
      unitBetAmount: BET_AMOUNT_PER_TICKET_USDT,
      dailyTotals,
      summary: {
        totalProductPurchaseAmount: summary.totalProductPurchaseAmount,
        totalBetAmount: summary.totalBetAmount,
        totalCombinedAmount: summary.totalCombinedAmount,
        daysWithData: dailyTotals.length,
        averageDailyCombinedAmount: dailyTotals.length > 0 ? summary.totalCombinedAmount / dailyTotals.length : 0,
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
