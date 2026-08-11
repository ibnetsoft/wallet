import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getBeijingToday, reopenRoundsForNewDay } from "@/lib/game-rounds";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(req: Request) {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(`SELECT value FROM public.system_settings WHERE key = 'auto_draw_enabled'`);
      let autoDrawEnabled = true;
      if (res.rows.length > 0) {
        autoDrawEnabled = res.rows[0].value === "true";
      }

      if (!autoDrawEnabled) {
        return NextResponse.json({ success: true, message: "Auto draw is currently DISABLED in settings." });
      }

      const { today, currentTime } = await getBeijingToday(client);
      await reopenRoundsForNewDay(client, today);

      const roundsRes = await client.query(
        `SELECT id, round_number, draw_time
         FROM public.game_rounds
         WHERE status = 'OPEN'
           AND draw_time <= $1::time
           AND COALESCE(last_processed_date, DATE '1970-01-01') < $2::date
         ORDER BY draw_time ASC, round_number ASC
         LIMIT 1`,
        [currentTime, today]
      );

      if (roundsRes.rows.length === 0) {
        return NextResponse.json({ success: true, message: "No open rounds ready for draw at this time." });
      }

      const roundToDraw = roundsRes.rows[0];
      const drawApiUrl = new URL("/api/game-rounds/draw", req.url).toString();

      const drawReq = await fetch(drawApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ round_id: roundToDraw.id })
      });

      const drawRes = await drawReq.json();
      if (!drawReq.ok || !drawRes.success) {
        console.error("Auto draw failed:", drawRes);
        return NextResponse.json(
          { success: false, error: drawRes.error || "Failed to execute draw API" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Auto draw triggered for round ${roundToDraw.round_number}`,
        data: drawRes
      });
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error("Auto draw cron error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Auto draw failed" },
      { status: 500 }
    );
  }
}
