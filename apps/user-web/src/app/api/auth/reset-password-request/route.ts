import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signAuthToken } from "@/lib/auth-token";

export async function POST(req: Request) {
  try {
    const { nickname } = await req.json();
    if (!nickname) {
      return NextResponse.json({ error: "?됰꽕?꾩쓣 ?낅젰??二쇱꽭??" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, nickname")
      .ilike("nickname", nickname.trim())
      .limit(1)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: "議댁옱?섏? ?딅뒗 ?됰꽕?꾩엯?덈떎." }, { status: 404 });
    }

    const token = signAuthToken({ userId: user.id, expiresAt: Date.now() + 15 * 60 * 1000 });
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const resetLink = `${proto}://${host}/reset-password?token=${token}`;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: "?쒕쾭 ?대찓???ㅼ젙(RESEND_API_KEY)???꾨씫?섏뿀?듬땲??" }, { status: 500 });
    }

    const fromEmail = process.env.EMAIL_FROM || "BAO369 <onboarding@resend.dev>";
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: user.email,
        subject: "[BAO369] 鍮꾨?踰덊샇 ?ъ꽕???덈궡",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #FCD535; background-color: #0B0E11; padding: 15px; text-align: center; border-radius: 8px;">BAO369 鍮꾨?踰덊샇 ?ъ꽕??</h2>
            <p>?덈뀞?섏꽭?? <strong>${user.nickname}</strong>??</p>
            <p>鍮꾨?踰덊샇瑜??ъ꽕?뺥븯?ㅻ㈃ ?꾨옒 踰꾪듉???대┃??二쇱꽭?? 蹂몄씤???붿껌?섏? ?딆쑝?⑤떎硫???硫붿씪??臾댁떆?섏뀛???덉쟾?⑸땲??</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #FCD535; color: #0B0E11; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">鍮꾨?踰덊샇 ?ъ꽕?뺥븯湲?/a>
            </div>
            <p style="color: #666; font-size: 12px;">??留곹겕??15遺??숈븞留??좏슚?⑸땲??</p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errData = await resendRes.json();
      return NextResponse.json({ error: `硫붿씪 ?꾩넚 ?ㅽ뙣: ${errData.message || JSON.stringify(errData)}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "鍮꾨?踰덊샇 ?ъ꽕??留곹겕媛 ?대찓?쇰줈 諛쒖넚?섏뿀?듬땲??" });
  } catch (error: unknown) {
    console.error("Reset password request error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "?쒕쾭 ?대? ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." },
      { status: 500 }
    );
  }
}
