import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  try {
    const query = `
      SELECT
        u.id,
        u.email,
        u.nickname,
        u.full_name,
        u.phone_number,
        u.status,
        u.created_at,
        ROW_NUMBER() OVER (ORDER BY u.created_at ASC, u.id ASC) AS member_number,
        NULL AS last_login_at,
        u.star_level,
        uw.address AS wallet_address,
        COALESCE(b_usdt.available_balance::numeric, 0) AS usdt_balance,
        COALESCE(b_bao.available_balance::numeric, 0) AS bao_balance,
        COALESCE(b_jade.available_balance::numeric, 0) AS jade_balance,
        COALESCE(b_hongbao.available_balance::numeric, 0) AS hongbao_balance,
        (SELECT COUNT(*) FROM public.users WHERE parent_id = u.id) AS total_referrals,
        COALESCE(ga.total_used_entries, 0) AS used_entries,
        s.email AS sponsor_email,
        s.nickname AS sponsor_nickname
      FROM public.users u
      LEFT JOIN public.user_wallets uw ON u.id = uw.user_id
      LEFT JOIN public.assets a_usdt ON a_usdt.symbol = 'USDT'
      LEFT JOIN public.user_balances b_usdt ON u.id = b_usdt.user_id AND b_usdt.asset_id = a_usdt.id
      LEFT JOIN public.assets a_bao ON a_bao.symbol = 'BAO'
      LEFT JOIN public.user_balances b_bao ON u.id = b_bao.user_id AND b_bao.asset_id = a_bao.id
      LEFT JOIN public.assets a_jade ON a_jade.symbol = 'JADE'
      LEFT JOIN public.user_balances b_jade ON u.id = b_jade.user_id AND b_jade.asset_id = a_jade.id
      LEFT JOIN public.assets a_hongbao ON a_hongbao.symbol = 'HONGBAO'
      LEFT JOIN public.user_balances b_hongbao ON u.id = b_hongbao.user_id AND b_hongbao.asset_id = a_hongbao.id
      LEFT JOIN public.v_user_game_allowance ga ON u.id = ga.user_id
      LEFT JOIN public.users s ON u.parent_id = s.id
      ORDER BY u.created_at DESC, u.id DESC
    `;

    const res = await pool.query(query);

    return NextResponse.json({
      success: true,
      users: res.rows.map((user: any) => ({
        id: user.id,
        email: user.email,
        nickname: user.nickname || "Unknown",
        fullName: user.full_name || "",
        phoneNumber: user.phone_number || "",
        memberNumber: Number(user.member_number),
        code: `969-${user.id.substring(0, 8).toUpperCase()}`,
        joinedAt: new Date(user.created_at).toISOString().split("T")[0],
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "기록없음",
        starLevel: user.star_level || 0,
        walletAddress: user.wallet_address || "미발급",
        assets: parseFloat(user.usdt_balance),
        baoBalance: parseFloat(user.bao_balance),
        jadeBalance: parseFloat(user.jade_balance),
        hongbaoBalance: parseFloat(user.hongbao_balance),
        active: user.status === "ACTIVE",
        totalReferrals: Number(user.total_referrals || 0),
        usedEntries: Number(user.used_entries || 0),
        sponsorEmail: user.sponsor_email || "없음",
        sponsorNickname: user.sponsor_nickname || "",
      })),
    });
  } catch (err: any) {
    console.error("GET api/users error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

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
