import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAuthenticatedUser } from "@/lib/current-user";
import { executeParticipation, ParticipationError } from "@/lib/game-participation";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required", error_code: "USER_SESSION_NOT_FOUND" },
      { status: 401 }
    );
  }

  try {
    const { round_id, tickets_count } = await req.json();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await executeParticipation({
        client,
        userId: user.id,
        roundId: Number(round_id),
        ticketsCount: Number(tickets_count),
      });

      await client.query("COMMIT");
      return NextResponse.json({ success: true, message: "Participation successful", result });
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      const errorCode = error instanceof ParticipationError ? error.code : "PARTICIPATION_FAILED";
      const errorMessage = error instanceof Error ? error.message : "Participation failed";
      console.error("Participation error:", error);
      return NextResponse.json(
        { success: false, error: errorMessage, error_code: errorCode },
        { status: 400 }
      );
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error("Participation API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", error_code: "INTERNAL_SERVER_ERROR" },
      { status: 500 }
    );
  }
}
