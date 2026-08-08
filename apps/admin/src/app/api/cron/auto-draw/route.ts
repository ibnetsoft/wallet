import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(req: Request) {
  try {
    // 1. Check if auto_draw is enabled
    const res = await pool.query(`SELECT value FROM public.system_settings WHERE key = 'auto_draw_enabled'`);
    let autoDrawEnabled = true; // default true if not set
    if (res.rows.length > 0) {
      autoDrawEnabled = res.rows[0].value === 'true';
    }

    if (!autoDrawEnabled) {
      return NextResponse.json({ success: true, message: 'Auto draw is currently DISABLED in settings.' });
    }

    // 2. Find any OPEN rounds where CURRENT_TIME >= draw_time
    const roundsRes = await pool.query(`
      SELECT id, round_number, draw_time 
      FROM public.game_rounds 
      WHERE status = 'OPEN' 
        AND draw_time <= (CURRENT_TIME AT TIME ZONE 'Asia/Seoul')::time
      ORDER BY round_number ASC
      LIMIT 1
    `);

    if (roundsRes.rows.length === 0) {
      return NextResponse.json({ success: true, message: 'No open rounds ready for draw at this time.' });
    }

    const roundToDraw = roundsRes.rows[0];

    // 3. Trigger the existing draw logic by calling the POST endpoint
    // req.url contains the domain (e.g. https://admin.domain.com/api/cron/auto-draw)
    const drawApiUrl = new URL('/api/game-rounds/draw', req.url).toString();
    
    const drawReq = await fetch(drawApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ round_id: roundToDraw.id })
    });

    const drawRes = await drawReq.json();

    if (!drawReq.ok || !drawRes.success) {
      console.error("Auto draw failed:", drawRes);
      return NextResponse.json({ success: false, error: drawRes.error || 'Failed to execute draw API' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Auto draw triggered for round ${roundToDraw.round_number}`, data: drawRes });
  } catch (error: any) {
    console.error('Auto draw cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
