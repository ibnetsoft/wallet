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
  if (!userId || !Number.isInteger(roundId) || !Number.isInteger(ticketsCount) || ticketsCount < 1 || ticketsCount > 100) {
    throw new ParticipationError("INVALID_PARAMETERS", "Invalid participation request");
  }

  const userRes = await client.query(
    `SELECT status
     FROM public.users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  );
  if (userRes.rows.length === 0) {
    throw new ParticipationError("USER_NOT_FOUND", "User profile not found");
  }
  if (userRes.rows[0].status !== "ACTIVE") {
    throw new ParticipationError("USER_NOT_ACTIVE", "Purchase a game machine before participating");
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
    `SELECT status, start_time, end_time, draw_time, last_processed_date
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

  const machinesRes = await client.query(
    `SELECT id, total_entry_limit, used_entries
     FROM public.user_game_machines
     WHERE user_id = $1
       AND used_entries < total_entry_limit
       AND accumulated_payout_usd < payout_limit_usd
     ORDER BY created_at ASC, id ASC
     FOR UPDATE`,
    [userId]
  );
  const remainingEntries = machinesRes.rows.reduce(
    (sum, machine) => sum + Number(machine.total_entry_limit) - Number(machine.used_entries),
    0
  );
  if (remainingEntries < ticketsCount) {
    throw new ParticipationError(
      "INSUFFICIENT_ENTRY_ALLOWANCE",
      "Insufficient purchased game entries"
    );
  }

  const assetsRes = await client.query(
    `SELECT id, symbol FROM public.assets WHERE symbol IN ('USDT', 'JADE')`
  );
  const assets = Object.fromEntries(assetsRes.rows.map((asset) => [asset.symbol, Number(asset.id)]));
  if (!assets.USDT || !assets.JADE) {
    throw new ParticipationError(
      "SYSTEM_ASSET_CONFIG_MISSING",
      "System assets not fully configured"
    );
  }

  const usdtRequired = 100 * ticketsCount;
  const jadeRequired = ticketsCount;

  const usdtBalance = await client.query(
    `UPDATE public.user_balances
     SET available_balance = available_balance - $1, updated_at = NOW()
     WHERE user_id = $2 AND asset_id = $3 AND available_balance >= $1
     RETURNING available_balance`,
    [usdtRequired, userId, assets.USDT]
  );
  if (usdtBalance.rows.length === 0) {
    throw new ParticipationError("INSUFFICIENT_USDT", "Insufficient USDT balance");
  }

  const jadeBalance = await client.query(
    `UPDATE public.user_balances
     SET available_balance = available_balance - $1, updated_at = NOW()
     WHERE user_id = $2 AND asset_id = $3 AND available_balance >= $1
     RETURNING available_balance`,
    [jadeRequired, userId, assets.JADE]
  );
  if (jadeBalance.rows.length === 0) {
    throw new ParticipationError("INSUFFICIENT_JADE", "Insufficient Jade Beads");
  }

  const entryClaims: Array<{ machineId: string; count: number }> = [];
  let entriesToClaim = ticketsCount;
  for (const machine of machinesRes.rows) {
    if (entriesToClaim === 0) break;
    const available = Number(machine.total_entry_limit) - Number(machine.used_entries);
    const claimed = Math.min(entriesToClaim, available);
    await client.query(
      `UPDATE public.user_game_machines
       SET used_entries = used_entries + $1
       WHERE id = $2`,
      [claimed, machine.id]
    );
    entryClaims.push({ machineId: String(machine.id), count: claimed });
    entriesToClaim -= claimed;
  }

  await client.query(
    `INSERT INTO public.ledger_entries (user_id, asset_id, tx_type, amount, status)
     VALUES ($1, $2, 'GAME_WAGER', $3, 'COMPLETED'),
            ($1, $4, 'GAME_WAGER', $5, 'COMPLETED')`,
    [userId, assets.USDT, -usdtRequired, assets.JADE, -jadeRequired]
  );

  const participantRes = await client.query(
    `INSERT INTO public.game_participants (round_id, user_id, round_date, tickets_count, status)
     VALUES ($1, $2, $3::date, $4, 'PENDING')
     ON CONFLICT (round_id, user_id, round_date) DO UPDATE SET
       tickets_count = public.game_participants.tickets_count + EXCLUDED.tickets_count,
       status = 'PENDING'
     RETURNING id`,
    [roundId, userId, today, ticketsCount]
  );

  const participantId = Number(participantRes.rows[0].id);
  for (const claim of entryClaims) {
    await client.query(
      `INSERT INTO public.game_participant_entry_claims (participant_id, machine_id, entries_count)
       VALUES ($1, $2, $3)
       ON CONFLICT (participant_id, machine_id) DO UPDATE
         SET entries_count = public.game_participant_entry_claims.entries_count + EXCLUDED.entries_count`,
      [participantId, claim.machineId, claim.count]
    );
  }

  return {
    today,
    currentTime,
    usdtRequired,
    jadeRequired,
    remainingEntries: remainingEntries - ticketsCount,
  };
}
