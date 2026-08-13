import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAuthenticatedUser } from "@/lib/current-user";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function normalizeRounds(rounds: unknown): number[] {
  if (!Array.isArray(rounds)) return [];
  return [...new Set(
    rounds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 6)
  )].sort((left, right) => left - right);
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  try {
    const res = await pool.query(
      `SELECT enabled, daily_repeat, rounds, bets_count
       FROM public.auto_bet_settings
       WHERE user_id = $1`,
      [user.id]
    );
    const row = res.rows[0];
    return NextResponse.json({
      success: true,
      settings: row
        ? {
            enabled: row.enabled,
            dailyRepeat: row.daily_repeat,
            rounds: row.rounds ?? [],
            betsCount: row.bets_count,
          }
        : { enabled: false, dailyRepeat: true, rounds: [], betsCount: 10 },
    });
  } catch (error: unknown) {
    console.error("GET auto-bet-settings error:", error);
    return NextResponse.json({ success: false, error: "Failed to load auto bet settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  try {
    const { enabled, dailyRepeat, rounds, betsCount } = await req.json();
    const normalizedRounds = normalizeRounds(rounds);
    const normalizedBetsCount = Number(betsCount);
    if (!Number.isInteger(normalizedBetsCount) || normalizedBetsCount < 1 || normalizedBetsCount > 100) {
      return NextResponse.json({ success: false, error: "betsCount must be between 1 and 100" }, { status: 400 });
    }
    if (enabled && normalizedRounds.length === 0) {
      return NextResponse.json({ success: false, error: "At least one round must be selected" }, { status: 400 });
    }

    const res = await pool.query(
      `INSERT INTO public.auto_bet_settings (user_id, enabled, daily_repeat, rounds, bets_count, updated_at)
       VALUES ($1, $2, $3, $4::int[], $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         daily_repeat = EXCLUDED.daily_repeat,
         rounds = EXCLUDED.rounds,
         bets_count = EXCLUDED.bets_count,
         updated_at = NOW()
       RETURNING enabled, daily_repeat, rounds, bets_count`,
      [user.id, Boolean(enabled), Boolean(dailyRepeat), normalizedRounds, normalizedBetsCount]
    );
    const row = res.rows[0];
    return NextResponse.json({
      success: true,
      settings: {
        enabled: row.enabled,
        dailyRepeat: row.daily_repeat,
        rounds: row.rounds ?? [],
        betsCount: row.bets_count,
      },
    });
  } catch (error: unknown) {
    console.error("POST auto-bet-settings error:", error);
    return NextResponse.json({ success: false, error: "Failed to save auto bet settings" }, { status: 500 });
  }
}
