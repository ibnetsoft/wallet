import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      );
    }

    // 1. Fetch user to verify they exist and are currently in PENDING state
    const { data: user, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, email, status, parent_id")
      .eq("id", userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (user.status === "ACTIVE") {
      return NextResponse.json(
        { success: false, error: "User is already active" },
        { status: 400 }
      );
    }

    // 2. Update user status to ACTIVE. 
    // This will fire the Postgres trigger: trg_user_activation
    // which increments sponsor's referral_count and applies 3-배수 pass-up placement.
    const { data: updatedUsers, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ status: "ACTIVE" })
      .eq("id", userId)
      .select("id, email, status, parent_id, placement_id, referral_count")
      .single();

    if (updateError || !updatedUsers) {
      return NextResponse.json(
        { success: false, error: `Activation failed: ${updateError?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User successfully activated. 369 Rollup placement completed.",
      user: {
        id: updatedUsers.id,
        email: updatedUsers.email,
        status: updatedUsers.status,
        parentId: updatedUsers.parent_id,
        placementId: updatedUsers.placement_id, // This is the final calculated placement parent after trigger execution
        referralCount: updatedUsers.referral_count
      }
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
