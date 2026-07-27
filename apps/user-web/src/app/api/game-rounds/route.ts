import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  try {
    const res = await pool.query("SELECT * FROM public.game_rounds ORDER BY round_number ASC");
    return NextResponse.json({ success: true, rounds: res.rows });
  } catch (err: any) {
    console.error("GET user game-rounds error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
