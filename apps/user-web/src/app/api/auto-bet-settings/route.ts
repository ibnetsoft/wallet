import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function normalizeRounds(rounds: unknown): number[] {
  if (!Array.isArray(rounds)) {
    return [];
  }

  return [...new Set(
    rounds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0)
  )].sort((a, b) => a - b);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { success: false, error: "userId is required" },
      { status: 400 }
    );
  }

  try {
    const res = await pool.query(
      `SELECT user_id, enabled, daily_repeat, rounds, bets_count
       FROM public.auto_bet_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({
        success: true,
        settings: {
          enabled: false,
          dailyRepeat: true,
          rounds: [],
          betsCount: 10,
        },
      });
    }

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
    console.error("GET auto-bet-settings error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load auto bet settings" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { user_id, enabled, dailyRepeat, rounds, betsCount } = await req.json();

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 }
      );
    }

    const normalizedRounds = normalizeRounds(rounds);
    const normalizedBetsCount = Number(betsCount);
    if (!Number.isInteger(normalizedBetsCount) || normalizedBetsCount < 1 || normalizedBetsCount > 100) {
      return NextResponse.json(
        { success: false, error: "betsCount must be an integer between 1 and 100" },
        { status: 400 }
      );
    }

    if (enabled && normalizedRounds.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one round must be selected" },
        { status: 400 }
      );
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
      [user_id, Boolean(enabled), Boolean(dailyRepeat), normalizedRounds, normalizedBetsCount]
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
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save auto bet settings" },
      { status: 500 }
    );
  }
}
