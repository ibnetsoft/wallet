import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getAuthenticatedUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }
  try {
    const result = await pool.query(
      `UPDATE public.users
       SET status = 'ACTIVE', recommender_id = COALESCE(recommender_id, parent_id)
       WHERE id = $1
       RETURNING id, email, status, parent_id, recommender_id, sponsor_id, original_recommender_id, referral_seq`,
      [user.id]
    );
    if (!result.rows[0]) {
      return NextResponse.json({ success: false, error: "User profile not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, user: result.rows[0] });
  } catch (error: unknown) {
    console.error("Activation error:", error);
    return NextResponse.json({ success: false, error: "Activation failed" }, { status: 500 });
  }
}
