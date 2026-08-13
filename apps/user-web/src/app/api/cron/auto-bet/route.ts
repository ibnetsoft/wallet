import { NextResponse } from "next/server";
import { Pool } from "pg";
import { isCronRequest } from "@/lib/cron-auth";
import { executeParticipation, ParticipationError } from "@/lib/game-participation";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function HEAD(request: Request) {
  return new NextResponse(null, { status: isCronRequest(request) ? 204 : 401 });
}

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const nowRes = await client.query(
      `SELECT (now() AT TIME ZONE 'Asia/Shanghai')::date AS today,
              (now() AT TIME ZONE 'Asia/Shanghai')::time AS current_time`
    );
    const today = nowRes.rows[0].today as string;
    const currentTime = nowRes.rows[0].current_time as string;

    await client.query(
      `UPDATE public.game_rounds
       SET status = 'OPEN'
       WHERE COALESCE(last_processed_date, DATE '1970-01-01') < $1::date
         AND status <> 'OPEN'`,
      [today]
    );

    const candidatesRes = await client.query(
      `SELECT s.user_id, s.daily_repeat, s.bets_count, gr.id AS round_id, gr.round_number
       FROM public.auto_bet_settings s
       JOIN public.game_rounds gr ON gr.round_number = ANY(s.rounds)
       LEFT JOIN public.auto_bet_executions ex
         ON ex.user_id = s.user_id
        AND ex.round_id = gr.id
        AND ex.round_date = $1::date
       WHERE s.enabled = TRUE
         AND cardinality(s.rounds) > 0
         AND gr.status = 'OPEN'
         AND COALESCE(gr.last_processed_date, DATE '1970-01-01') < $1::date
         AND gr.start_time <= $2::time
         AND $2::time < COALESCE(gr.draw_time, gr.end_time)::time
         AND ex.id IS NULL
       ORDER BY gr.round_number ASC, s.user_id ASC`,
      [today, currentTime]
    );

    const results: Array<{ userId: string; roundNumber: number; status: string; error?: string }> = [];
    for (const candidate of candidatesRes.rows) {
      const runClient = await pool.connect();
      try {
        await runClient.query("BEGIN");
        const executionRes = await runClient.query(
          `INSERT INTO public.auto_bet_executions (user_id, round_id, round_date, status)
           VALUES ($1, $2, $3::date, 'RUNNING')
           ON CONFLICT (user_id, round_id, round_date) DO NOTHING
           RETURNING id`,
          [candidate.user_id, candidate.round_id, today]
        );
        if (executionRes.rows.length === 0) {
          await runClient.query("ROLLBACK");
          continue;
        }

        try {
          await executeParticipation({
            client: runClient,
            userId: candidate.user_id,
            roundId: Number(candidate.round_id),
            ticketsCount: Number(candidate.bets_count),
          });
          await runClient.query(
            `UPDATE public.auto_bet_executions
             SET status = 'SUCCESS', error_message = NULL
             WHERE user_id = $1 AND round_id = $2 AND round_date = $3::date`,
            [candidate.user_id, candidate.round_id, today]
          );
          if (!candidate.daily_repeat) {
            await runClient.query(
              `UPDATE public.auto_bet_settings
               SET rounds = array_remove(rounds, $2::int),
                   enabled = cardinality(array_remove(rounds, $2::int)) > 0,
                   updated_at = NOW()
               WHERE user_id = $1`,
              [candidate.user_id, candidate.round_number]
            );
          }
          await runClient.query("COMMIT");
          results.push({ userId: candidate.user_id, roundNumber: Number(candidate.round_number), status: "SUCCESS" });
        } catch (error: unknown) {
          const code = error instanceof ParticipationError ? error.code : "AUTO_BET_FAILED";
          const message = error instanceof Error ? error.message : "Auto bet failed";
          await runClient.query(
            `UPDATE public.auto_bet_executions
             SET status = 'FAILED', error_message = $4
             WHERE user_id = $1 AND round_id = $2 AND round_date = $3::date`,
            [candidate.user_id, candidate.round_id, today, `${code}: ${message}`]
          );
          await runClient.query("COMMIT");
          results.push({ userId: candidate.user_id, roundNumber: Number(candidate.round_number), status: "FAILED", error: `${code}: ${message}` });
        }
      } finally {
        runClient.release();
      }
    }

    return NextResponse.json({ success: true, date: today, currentTime, processed: results.length, results });
  } catch (error: unknown) {
    console.error("Auto bet cron error:", error);
    return NextResponse.json({ success: false, error: "Auto bet failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
