import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Mark as dynamic so Next.js doesn't attempt static generation
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId query parameter is required" },
        { status: 400 }
      );
    }

    // ── 1. 추천 계보도 (Direct Referral Tree) ──────────────────────────
    // recommender_id = userId 인 회원 목록 (내 직추천 1대 전체)
    const { data: directReferrals, error: directError } = await supabaseAdmin
      .from("users")
      .select("id, nickname, email, status, referral_seq, accumulated_revenue, created_at")
      .eq("recommender_id", userId)
      .order("referral_seq", { ascending: true });

    if (directError) {
      return NextResponse.json(
        { success: false, error: `Direct tree fetch failed: ${directError.message}` },
        { status: 500 }
      );
    }

    // ── 2. 후원 계보도 (Sponsor Tree - 369 Pass-Up 반영) ────────────────
    // sponsor_id = userId 인 회원 목록 (내 후원 1대: 기존 식구 + 롤업 유입 사위/며느리)
    const { data: sponsorDownline, error: sponsorError } = await supabaseAdmin
      .from("users")
      .select("id, nickname, email, status, recommender_id, sponsor_id, original_recommender_id, referral_seq, accumulated_revenue, created_at")
      .eq("sponsor_id", userId)
      .order("created_at", { ascending: true });

    if (sponsorError) {
      return NextResponse.json(
        { success: false, error: `Sponsor tree fetch failed: ${sponsorError.message}` },
        { status: 500 }
      );
    }

    // ── 3. 나의 game machines에서 최탄 티켓 합산 ───────────────────────
    const { data: machineData } = await supabaseAdmin
      .from("user_game_machines")
      .select("package_level, cheotan_tickets")
      .eq("user_id", userId);

    const totalCheotanTickets = (machineData ?? []).reduce(
      (sum: number, m: any) => sum + (Number(m.cheotan_tickets) || 0),
      0
    );

    // ── 4. 응답 조합 ────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        // 추천 계보: 직추천 1대 전체 (추천보너스 20% 기준 라인)
        directTree: (directReferrals ?? []).map((u: any) => ({
          id: u.id,
          nickname: u.nickname || u.email,
          status: u.status,
          referralSeq: u.referral_seq,
          totalPurchase: Number(u.accumulated_revenue) || 0,
          // 3배수 = 후원계보에서 상위 스폰서에게 롤업된 대상
          isRollup: u.referral_seq % 3 === 0,
        })),

        // 후원 계보: 육성보너스 10% 대상 (후원 1대 전체)
        sponsorTree: (sponsorDownline ?? []).map((u: any) => ({
          id: u.id,
          nickname: u.nickname || u.email,
          status: u.status,
          tier: 1,
          // original_recommender_id 존재 = 롤업으로 나에게 배속된 사위/며느리
          isRolledIn: !!u.original_recommender_id && u.original_recommender_id !== u.recommender_id,
          originalRecommender: u.original_recommender_id ?? null,
          salesVolume: Number(u.accumulated_revenue) || 0,
        })),

        // 최탄 티켓 합계
        totalCheotanTickets,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
