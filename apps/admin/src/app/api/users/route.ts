import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET() {
  try {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.nickname,
        u.status,
        u.created_at,
        COALESCE(b.available_balance::numeric, 0) as usdt_balance
      FROM public.users u
      LEFT JOIN public.user_balances b ON u.id = b.user_id AND b.asset_id = 2
      ORDER BY u.created_at DESC
    `;
    const res = await pool.query(query);

    return NextResponse.json({
      success: true,
      users: res.rows.map((u: any) => ({
        id: u.id,
        email: u.email,
        nickname: u.nickname || "유저",
        code: `URC-${u.id.substring(0, 8).toUpperCase()}`,
        joinedAt: new Date(u.created_at).toISOString().split("T")[0],
        assets: parseFloat(u.usdt_balance),
        active: u.status === "ACTIVE"
      }))
    });
  } catch (err: any) {
    console.error("GET api/users error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
