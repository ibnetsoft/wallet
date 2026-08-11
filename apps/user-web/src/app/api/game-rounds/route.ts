import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getRoundAvailability } from "@/lib/game-rounds";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

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

      const res = await client.query(
        "SELECT * FROM public.game_rounds ORDER BY round_number ASC"
      );

      await client.query("COMMIT");

      const rounds = res.rows.map((round) => {
        const availability = getRoundAvailability(round, currentTime, today);

        return {
          ...round,
          current_time: currentTime,
          beijing_date: today,
          close_time: availability.closeTime,
          can_participate: availability.canParticipate,
          availability_reason: availability.reason,
        };
      });

      return NextResponse.json({ success: true, rounds });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("GET user game-rounds error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
