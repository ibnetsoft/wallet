import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthToken } from "@/lib/auth-token";

type ResetPasswordTokenPayload = {
  userId: string;
  expiresAt: number;
};

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: "?꾩닔 ?곗씠?곌? ?꾨씫?섏뿀?듬땲??" }, { status: 400 });
    }

    let userId = "";
    try {
      userId = verifyAuthToken<ResetPasswordTokenPayload>(token).userId;
    } catch {
      return NextResponse.json({ error: "?좏슚?섏? ?딆? ?좏겙?낅땲??" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (authError) {
      console.error("Auth password reset error:", authError);
      return NextResponse.json({ error: `鍮꾨?踰덊샇 ?낅뜲?댄듃 ?ㅽ뙣: ${authError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "鍮꾨?踰덊샇媛 ?깃났?곸쑝濡??ъ꽕?뺣릺?덉뒿?덈떎." });
  } catch (error: unknown) {
    console.error("Reset password confirm error:", error);
    return NextResponse.json({ error: "?쒕쾭 ?대? ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." }, { status: 500 });
  }
}
