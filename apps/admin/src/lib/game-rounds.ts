import type { PoolClient } from "pg";

export async function getBeijingToday(client: PoolClient) {
  const res = await client.query(
    `SELECT (now() AT TIME ZONE 'Asia/Shanghai')::date AS today,
            (now() AT TIME ZONE 'Asia/Shanghai')::time AS current_time`
  );

  return {
    today: res.rows[0].today as string,
    currentTime: res.rows[0].current_time as string,
  };
}

export async function reopenRoundsForNewDay(client: PoolClient, today: string) {
  await client.query(
    `UPDATE public.game_rounds
     SET status = 'OPEN'
     WHERE COALESCE(last_processed_date, DATE '1970-01-01') < $1::date
       AND status <> 'OPEN'`,
    [today]
  );
}
