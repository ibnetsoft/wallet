import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

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

    // 1. Fetch Direct Tree (추천계보도)
    // All members directly referred by C (Me)
    const { data: directReferrals, error: directError } = await supabaseAdmin
      .from("users")
      .select("id, email, status, referral_count, created_at")
      .eq("parent_id", userId)
      .order("created_at", { ascending: true });

    if (directError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch direct line: ${directError.message}` },
        { status: 500 }
      );
    }

    // 2. Fetch Placement Tree (후원계보도 - 369 패스업 반영)
    // All members placed under C (Me) as their placement parent
    const { data: placementDownline, error: placementError } = await supabaseAdmin
      .from("users")
      .select("id, email, status, parent_id, placement_id, referral_count, created_at")
      .eq("placement_id", userId)
      .order("created_at", { ascending: true });

    if (placementError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch placement line: ${placementError.message}` },
        { status: 500 }
      );
    }

    // For the UI visualization, we also fetch the grandchildren (2nd tier placement)
    // to render a proper 3-tier visual tree.
    // We extract the placement IDs of the 1st tier downline to fetch their child nodes.
    const firstTierIds = placementDownline?.map(u => u.id) || [];
    
    let secondTierDownline: any[] = [];
    if (firstTierIds.length > 0) {
      const { data: secTier, error: secError } = await supabaseAdmin
        .from("users")
        .select("id, email, status, parent_id, placement_id, referral_count, created_at")
        .in("placement_id", firstTierIds);
      
      if (!secError && secTier) {
        secondTierDownline = secTier;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        directTree: directReferrals.map((u, index) => ({
          id: u.id,
          email: u.email,
          status: u.status,
          referralCount: u.referral_count,
          joinOrder: index + 1 // Indicates their 1, 2, 3, 4th sign-up order
        })),
        placementTree: {
          firstTier: placementDownline.map(u => ({
            id: u.id,
            email: u.email,
            status: u.status,
            parentId: u.parent_id,
            placementId: u.placement_id,
            referralCount: u.referral_count,
            // If the user's parent_id is different from the placement_id, it was rolled up
            isRolledUp: u.parent_id !== u.placement_id
          })),
          secondTier: secondTierDownline.map(u => ({
            id: u.id,
            email: u.email,
            status: u.status,
            parentId: u.parent_id,
            placementId: u.placement_id,
            referralCount: u.referral_count,
            isRolledUp: u.parent_id !== u.placement_id
          }))
        }
      }
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
