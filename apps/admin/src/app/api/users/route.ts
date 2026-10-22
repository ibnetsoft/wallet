import { NextResponse } from "next/server";
import { Pool, PoolClient } from "pg";
import { getAdminUser } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

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
        to_char(u.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS joined_at_kst,
        ROW_NUMBER() OVER (ORDER BY u.created_at ASC, u.id ASC) AS member_number,
        NULL AS last_login_at,
        u.star_level,
        uw.wallets,
        COALESCE(b_usdt.available_balance::numeric, 0) AS usdt_balance,
        COALESCE(b_bao.available_balance::numeric, 0) AS bao_balance,
        COALESCE(b_jade.available_balance::numeric, 0) AS jade_balance,
        COALESCE(b_hongbao.available_balance::numeric, 0) AS hongbao_balance,
        (SELECT COUNT(*) FROM public.users WHERE parent_id = u.id) AS total_referrals,
        COALESCE(ga.total_used_entries, 0) AS used_entries,
        s.email AS sponsor_email,
        s.nickname AS sponsor_nickname,
        u.recommender_id
      FROM public.users u
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object('chainType', chain_type, 'address', address)
          ORDER BY chain_type, address
        ) AS wallets
        FROM public.user_wallets
        WHERE user_id = u.id
      ) uw ON true
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
        joinedAt: user.joined_at_kst,
        lastLoginAt: user.last_login_at ? new Date(user.last_login_at).toLocaleString() : "기록없음",
        starLevel: user.star_level || 0,
        walletAddress: user.wallets?.[0]?.address || "미발급",
        wallets: user.wallets || [],
        assets: parseFloat(user.usdt_balance),
        baoBalance: parseFloat(user.bao_balance),
        jadeBalance: parseFloat(user.jade_balance),
        hongbaoBalance: parseFloat(user.hongbao_balance),
        active: user.status === "ACTIVE",
        canChangeRecommender: user.status === "PENDING",
        totalReferrals: Number(user.total_referrals || 0),
        usedEntries: Number(user.used_entries || 0),
        sponsorEmail: user.sponsor_email || "없음",
        sponsorNickname: user.sponsor_nickname || "",
        recommenderId: user.recommender_id || null,
      })),
    });
  } catch (err: any) {
    console.error("GET api/users error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

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

export async function PATCH(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let client: PoolClient | undefined;

  try {
    const body = await request.json();
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const recommenderId = typeof body?.recommenderId === "string" ? body.recommenderId.trim() : null;

    if (!userId) {
      return NextResponse.json({ success: false, error: "변경할 회원을 선택해 주세요." }, { status: 400 });
    }
    if (recommenderId === userId) {
      return NextResponse.json({ success: false, error: "본인은 본인의 추천인이 될 수 없습니다." }, { status: 400 });
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const target = await client.query(
      "SELECT id, nickname, status FROM public.users WHERE id = $1 FOR UPDATE",
      [userId],
    );
    if (target.rowCount !== 1) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, error: "회원을 찾을 수 없습니다." }, { status: 404 });
    }
    if (target.rows[0].status !== "PENDING") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "추천인은 미구매 상태의 회원만 변경할 수 있습니다." },
        { status: 400 },
      );
    }

    let recommender: { id: string; nickname: string | null; email: string | null } | null = null;
    if (recommenderId) {
      const recommenderResult = await client.query(
        "SELECT id, nickname, email FROM public.users WHERE id = $1 FOR UPDATE",
        [recommenderId],
      );
      if (recommenderResult.rowCount !== 1) {
        await client.query("ROLLBACK");
        return NextResponse.json({ success: false, error: "선택한 추천인을 찾을 수 없습니다." }, { status: 404 });
      }
      recommender = recommenderResult.rows[0];

      const cycleCheck = await client.query(
        `WITH RECURSIVE ancestors AS (
           SELECT id, recommender_id, ARRAY[id] AS path
           FROM public.users
           WHERE id = $1
           UNION ALL
           SELECT u.id, u.recommender_id, a.path || u.id
           FROM public.users u
           JOIN ancestors a ON u.id = a.recommender_id
           WHERE NOT u.id = ANY(a.path)
         )
         SELECT 1 FROM ancestors WHERE id = $2 LIMIT 1`,
        [recommenderId, userId],
      );
      if ((cycleCheck.rowCount ?? 0) > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, error: "하위 회원을 추천인으로 지정할 수 없습니다. 추천 관계가 순환됩니다." },
          { status: 400 },
        );
      }
    }

    await client.query(
      `UPDATE public.users
       SET parent_id = $2, recommender_id = $2
       WHERE id = $1`,
      [userId, recommenderId],
    );
    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      recommendation: {
        userId,
        recommenderId: recommender?.id ?? null,
        recommenderNickname: recommender?.nickname ?? "",
        recommenderEmail: recommender?.email ?? "없음",
      },
    });
  } catch (err: unknown) {
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    console.error("PATCH api/users error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "추천인 변경 중 오류가 발생했습니다." },
      { status: 500 },
    );
  } finally {
    client?.release();
  }
}
