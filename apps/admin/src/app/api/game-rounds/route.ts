import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// GET: List all rounds sorted by round_number
export async function GET() {
  try {
    const res = await pool.query("SELECT * FROM public.game_rounds ORDER BY round_number ASC");
    return NextResponse.json({ success: true, rounds: res.rows });
  } catch (err: any) {
    console.error("GET game-rounds error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Add a new round
export async function POST(request: Request) {
  try {
    const { round_number, start_time, end_time } = await request.json();

    if (!round_number || !start_time || !end_time) {
      return NextResponse.json({ success: false, error: "round_number, start_time, and end_time are required" }, { status: 400 });
    }

    // Automatically calculate draw_time as end_time + 30 minutes
    const [h, m] = end_time.split(":");
    const endMinutes = parseInt(h) * 60 + parseInt(m);
    const drawMinutes = (endMinutes + 30) % 1440;
    const drawH = Math.floor(drawMinutes / 60).toString().padStart(2, "0");
    const drawM = (drawMinutes % 60).toString().padStart(2, "0");
    const draw_time = `${drawH}:${drawM}:00`;

    const query = `
      INSERT INTO public.game_rounds (round_number, start_time, end_time, draw_time)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (round_number) DO UPDATE SET
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        draw_time = EXCLUDED.draw_time
      RETURNING *
    `;
    const res = await pool.query(query, [round_number, start_time, end_time, draw_time]);

    return NextResponse.json({ success: true, round: res.rows[0] });
  } catch (err: any) {
    console.error("POST game-rounds error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PUT: Update an existing round
export async function PUT(request: Request) {
  try {
    const { id, round_number, start_time, end_time } = await request.json();

    if (!id || !round_number || !start_time || !end_time) {
      return NextResponse.json({ success: false, error: "id, round_number, start_time, and end_time are required" }, { status: 400 });
    }

    // Automatically calculate draw_time as end_time + 30 minutes
    const [h, m] = end_time.split(":");
    const endMinutes = parseInt(h) * 60 + parseInt(m);
    const drawMinutes = (endMinutes + 30) % 1440;
    const drawH = Math.floor(drawMinutes / 60).toString().padStart(2, "0");
    const drawM = (drawMinutes % 60).toString().padStart(2, "0");
    const draw_time = `${drawH}:${drawM}:00`;

    const query = `
      UPDATE public.game_rounds
      SET round_number = $1, start_time = $2, end_time = $3, draw_time = $4
      WHERE id = $5
      RETURNING *
    `;
    const res = await pool.query(query, [round_number, start_time, end_time, draw_time, id]);

    return NextResponse.json({ success: true, round: res.rows[0] });
  } catch (err: any) {
    console.error("PUT game-rounds error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Delete a round
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "id parameter is required" }, { status: 400 });
    }

    await pool.query("DELETE FROM public.game_rounds WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE game-rounds error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
