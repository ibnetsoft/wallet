import type { PoolClient } from "pg";
import { getRoundAvailability, getRoundAvailabilityMessage } from "@/lib/game-rounds";

export class ParticipationError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type ExecuteParticipationParams = {
  client: PoolClient;
  userId: string;
  roundId: number;
  ticketsCount: number;
};

export async function executeParticipation({
  client,
  userId,
  roundId,
  ticketsCount,
}: ExecuteParticipationParams) {
  if (!userId || !roundId || !ticketsCount || ticketsCount <= 0) {
    throw new ParticipationError("INVALID_PARAMETERS", "Invalid parameters");
  }

  const todayRes = await client.query(
    `SELECT (now() AT TIME ZONE 'Asia/Shanghai')::date AS today`
  );
  const today = todayRes.rows[0].today;

  await client.query(
    `UPDATE public.game_rounds
     SET status = 'OPEN'
     WHERE id = $1
       AND COALESCE(last_processed_date, DATE '1970-01-01') < $2::date`,
    [roundId, today]
  );

  const roundRes = await client.query(
    `SELECT status, start_time, end_time, last_processed_date
     FROM public.game_rounds
     WHERE id = $1
     FOR UPDATE`,
    [roundId]
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

  const usdtRequired = 100 * ticketsCount;
  const jadeRequired = 1 * ticketsCount;

  const usdtBalRes = await client.query(
    `UPDATE public.user_balances SET available_balance = available_balance - $1, updated_at = NOW()
     WHERE user_id = $2 AND asset_id = $3 AND available_balance >= $1 RETURNING available_balance`,
    [usdtRequired, userId, assets.USDT]
  );
  if (usdtBalRes.rows.length === 0) {
    throw new ParticipationError("INSUFFICIENT_USDT", "Insufficient USDT balance");
  }

  const jadeBalRes = await client.query(
    `UPDATE public.user_balances SET available_balance = available_balance - $1, updated_at = NOW()
     WHERE user_id = $2 AND asset_id = $3 AND available_balance >= $1 RETURNING available_balance`,
    [jadeRequired, userId, assets.JADE]
  );
  if (jadeBalRes.rows.length === 0) {
    throw new ParticipationError("INSUFFICIENT_JADE", "Insufficient Jade Beads");
  }

  await client.query(
    `INSERT INTO public.ledger_entries (user_id, asset_id, tx_type, amount, status)
     VALUES ($1, $2, 'GAME_WAGER', $3, 'COMPLETED'),
            ($1, $4, 'GAME_WAGER', $5, 'COMPLETED')`,
    [userId, assets.USDT, -usdtRequired, assets.JADE, -jadeRequired]
  );

  await client.query(
    `INSERT INTO public.game_participants (round_id, user_id, round_date, tickets_count, status)
     VALUES ($1, $2, $3::date, $4, 'PENDING')
     ON CONFLICT (round_id, user_id, round_date) DO UPDATE SET
       tickets_count = public.game_participants.tickets_count + EXCLUDED.tickets_count,
       status = 'PENDING'`,
    [roundId, userId, today, ticketsCount]
  );

  return {
    today,
    currentTime,
    usdtRequired,
    jadeRequired,
  };
}
