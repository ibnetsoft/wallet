import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getRoundAvailability, getRoundAvailabilityMessage } from "@/lib/game-rounds";

class ParticipationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(req: Request) {
  try {
    const { user_id, round_id, tickets_count } = await req.json();

    if (!user_id || !round_id || !tickets_count || tickets_count <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid parameters", error_code: "INVALID_PARAMETERS" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const todayRes = await client.query(
        `SELECT (now() AT TIME ZONE 'Asia/Shanghai')::date AS today`
      );
      const today = todayRes.rows[0].today;

      await client.query(
        `UPDATE public.game_rounds
         SET status = 'OPEN'
         WHERE id = $1
           AND COALESCE(last_processed_date, DATE '1970-01-01') < $2::date`,
        [round_id, today]
      );

      const roundRes = await client.query(
        `SELECT status, start_time, end_time, last_processed_date
         FROM public.game_rounds
         WHERE id = $1
         FOR UPDATE`,
        [round_id]
      );
      if (roundRes.rows.length === 0) {
        throw new ParticipationError("ROUND_NOT_FOUND", "Round not found");
      }

      const timeRes = await client.query(
        `SELECT (now() AT TIME ZONE 'Asia/Shanghai')::time AS current_time`
      );
      const currentTime = timeRes.rows[0].current_time as string;

      const availability = getRoundAvailability(roundRes.rows[0], currentTime, today);
      if (!availability.canParticipate) {
        throw new ParticipationError(
          availability.reason,
          getRoundAvailabilityMessage(availability.reason)
        );
      }

      const assetsRes = await client.query(
        `SELECT id, symbol FROM public.assets WHERE symbol IN ('USDT', 'JADE')`
      );
      const assets = Object.fromEntries(assetsRes.rows.map((a) => [a.symbol, a.id]));
      if (!assets.USDT || !assets.JADE) {
        throw new ParticipationError(
          "SYSTEM_ASSET_CONFIG_MISSING",
          "System assets not fully configured (USDT or JADE missing)"
        );
      }

      const usdtRequired = 100 * tickets_count;
      const jadeRequired = 1 * tickets_count;

      const usdtBalRes = await client.query(
        `UPDATE public.user_balances SET available_balance = available_balance - $1, updated_at = NOW()
         WHERE user_id = $2 AND asset_id = $3 AND available_balance >= $1 RETURNING available_balance`,
        [usdtRequired, user_id, assets.USDT]
      );
      if (usdtBalRes.rows.length === 0) {
        throw new ParticipationError("INSUFFICIENT_USDT", "Insufficient USDT balance");
      }

      const jadeBalRes = await client.query(
        `UPDATE public.user_balances SET available_balance = available_balance - $1, updated_at = NOW()
         WHERE user_id = $2 AND asset_id = $3 AND available_balance >= $1 RETURNING available_balance`,
        [jadeRequired, user_id, assets.JADE]
      );
      if (jadeBalRes.rows.length === 0) {
        throw new ParticipationError("INSUFFICIENT_JADE", "Insufficient Jade Beads");
      }

      await client.query(
        `INSERT INTO public.ledger_entries (user_id, asset_id, tx_type, amount, status)
         VALUES ($1, $2, 'GAME_WAGER', $3, 'COMPLETED'),
                ($1, $4, 'GAME_WAGER', $5, 'COMPLETED')`,
        [user_id, assets.USDT, -usdtRequired, assets.JADE, -jadeRequired]
      );

      await client.query(
        `INSERT INTO public.game_participants (round_id, user_id, round_date, tickets_count, status)
         VALUES ($1, $2, $3::date, $4, 'PENDING')
         ON CONFLICT (round_id, user_id, round_date) DO UPDATE SET
           tickets_count = public.game_participants.tickets_count + EXCLUDED.tickets_count,
           status = 'PENDING'`,
        [round_id, user_id, today, tickets_count]
      );

      await client.query("COMMIT");
      return NextResponse.json({ success: true, message: "Participation successful" });
    } catch (e: unknown) {
      await client.query("ROLLBACK");
      console.error("Participation error:", e);

      const errorCode = e instanceof ParticipationError ? e.code : "PARTICIPATION_FAILED";
      const errorMessage = e instanceof Error ? e.message : "Participation failed";

      return NextResponse.json(
        { success: false, error: errorMessage, error_code: errorCode },
        { status: 400 }
      );
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    console.error("API error:", err);
    return NextResponse.json(
      { success: false, error: "Internal Server Error", error_code: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
