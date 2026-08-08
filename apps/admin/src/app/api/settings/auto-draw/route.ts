import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  try {
    const res = await pool.query(`SELECT value FROM public.system_settings WHERE key = 'auto_draw_enabled'`);
    let enabled = true; // default
    if (res.rows.length > 0) {
      enabled = res.rows[0].value === 'true';
    }
    return NextResponse.json({ success: true, enabled });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { enabled } = await req.json();
    const valueStr = enabled ? 'true' : 'false';

    await pool.query(`
      INSERT INTO public.system_settings (key, value, description) 
      VALUES ('auto_draw_enabled', $1, '게임 자동 추첨 스케줄러 활성화 여부')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [valueStr]);

    return NextResponse.json({ success: true, enabled });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
