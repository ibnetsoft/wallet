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
    await pool.query(`UPDATE public.users SET last_login_at = NOW() WHERE id = $1`, [user.id]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Record login error:", error);
    return NextResponse.json({ success: false, error: "Failed to record login" }, { status: 500 });
  }
}
