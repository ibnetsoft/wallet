import { NextResponse } from "next/server";
import { Pool } from "pg";
import { executeParticipation, ParticipationError } from "@/lib/game-participation";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function POST(req: Request) {
  try {
    const { user_id, round_id, tickets_count } = await req.json();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await executeParticipation({
        client,
        userId: user_id,
        roundId: Number(round_id),
        ticketsCount: Number(tickets_count),
      });

      await client.query("COMMIT");
      return NextResponse.json({ success: true, message: "Participation successful" });
    } catch (e: unknown) {
      await client.query("ROLLBACK");
      console.error("Participation error:", e);

      const errorCode = e instanceof ParticipationError ? e.code : "PARTICIPATION_FAILED";
      const errorMessage = e instanceof Error ? e.message : "Participation failed";

      return NextResponse.json(
        { success: false, error: errorMessage, error_code: errorCode },
        { status: 400 }
      );
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    console.error("API error:", err);
    return NextResponse.json(
      { success: false, error: "Internal Server Error", error_code: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
