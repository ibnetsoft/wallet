import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("record-login error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
