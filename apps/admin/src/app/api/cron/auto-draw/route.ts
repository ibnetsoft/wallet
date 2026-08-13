import { NextResponse } from "next/server";
import { Pool } from "pg";
import { createCronUrl, isCronRequest } from "@/lib/cron-auth";
import { getBeijingToday, reopenRoundsForNewDay } from "@/lib/game-rounds";

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
    const setting = await client.query(`SELECT value FROM public.system_settings WHERE key = 'auto_draw_enabled'`);
    if (setting.rows[0] && setting.rows[0].value !== "true") {
      return NextResponse.json({ success: true, message: "Auto draw is disabled", processed: 0 });
    }

    const { today, currentTime } = await getBeijingToday(client);
    await reopenRoundsForNewDay(client, today);
    const rounds = await client.query(
      `SELECT id, round_number
       FROM public.game_rounds
       WHERE status = 'OPEN'
         AND draw_time <= $1::time
         AND COALESCE(last_processed_date, DATE '1970-01-01') < $2::date
       ORDER BY draw_time ASC, round_number ASC`,
      [currentTime, today]
    );

    const drawUrl = createCronUrl(new URL("/api/game-rounds/draw", request.url)).toString();
    const results: Array<{ roundNumber: number; success: boolean; error?: string }> = [];
    for (const round of rounds.rows) {
      const response = await fetch(drawUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ round_id: round.id }),
      });
      const data = await response.json().catch(() => ({}));
      results.push({
        roundNumber: Number(round.round_number),
        success: response.ok && Boolean(data.success),
        error: response.ok && data.success ? undefined : (data.error || "Draw failed"),
      });
    }

    return NextResponse.json({ success: results.every((result) => result.success), date: today, currentTime, processed: results.length, results });
  } catch (error: unknown) {
    console.error("Auto draw cron error:", error);
    return NextResponse.json({ success: false, error: "Auto draw failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
