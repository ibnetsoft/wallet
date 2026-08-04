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
        COALESCE(b.available_balance::numeric, 0) as usdt_balance,
        (SELECT COUNT(*) FROM public.users WHERE recommender_id = u.id) as total_referrals,
        COALESCE(ga.total_used_entries, 0) as used_entries,
        s.email as sponsor_email,
        s.nickname as sponsor_nickname
      FROM public.users u
      LEFT JOIN public.user_balances b ON u.id = b.user_id AND b.asset_id = 2
      LEFT JOIN public.v_user_game_allowance ga ON u.id = ga.user_id
      LEFT JOIN public.users s ON u.sponsor_id = s.id
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
        active: u.status === "ACTIVE",
        totalReferrals: parseInt(u.total_referrals || 0),
        usedEntries: parseInt(u.used_entries || 0),
        sponsorEmail: u.sponsor_email || "없음",
        sponsorNickname: u.sponsor_nickname || ""
      }))
    });
  } catch (err: any) {
    console.error("GET api/users error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });

    // public.users 에서 삭제하면 연관된 테이블들은 CASCADE 로 지워짐.
    // auth.users 까지 삭제하려면 supabase admin API 가 필요하지만 일단 public.users 레코드 삭제
    const deleteRes = await pool.query("DELETE FROM public.users WHERE id = $1 RETURNING id", [userId]);
    
    if (deleteRes.rowCount === 0) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: userId });
  } catch (err: any) {
    console.error("DELETE api/users error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
