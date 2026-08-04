import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(request: Request) {
  try {
    const { rows } = await request.json();
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: "Invalid rows data" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of rows) {
        await client.query(`
          INSERT INTO public.system_settings (key, value, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        `, [row.key, row.value, row.description]);
      }
      await client.query("COMMIT");
      return NextResponse.json({ success: true });
    } catch (e: any) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("settings/save API error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
