import { NextResponse } from "next/server";
import { signAuthToken } from "@/lib/auth-token";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "?대찓??二쇱냼瑜??낅젰??二쇱꽭??" }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: "?쒕쾭 ?대찓???ㅼ젙(RESEND_API_KEY)???꾨씫?섏뿀?듬땲??" }, { status: 500 });
    }

    const token = signAuthToken({ email, expiresAt: Date.now() + 15 * 60 * 1000 });
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const confirmLink = `${proto}://${host}/api/auth/verify-email?token=${token}`;

    const fromEmail = process.env.EMAIL_FROM || "BAO369 <onboarding@resend.dev>";

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: "[BAO369] ?뚯썝媛?낆쓣 ?꾪븳 ?대찓???몄쬆 ?덈궡",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #FCD535; background-color: #0B0E11; padding: 15px; text-align: center; border-radius: 8px;">BAO369 ?대찓???몄쬆</h2>
            <p>?덈뀞?섏꽭??</p>
            <p>BAO369 ?뚯썝媛?낆쓣 怨꾩냽?섎젮硫??꾨옒 踰꾪듉???대┃?섏뿬 ?대찓??二쇱냼 ?몄쬆???꾨즺??二쇱꽭??</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmLink}" style="background-color: #FCD535; color: #0B0E11; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">?대찓???몄쬆 ?꾨즺?섍린</a>
            </div>
            <p style="color: #666; font-size: 12px;">??留곹겕??15遺??숈븞留??좏슚?⑸땲?? 媛???붿껌???섏? ?딆쑝?⑤떎硫???硫붿씪??臾댁떆?섏뀛???⑸땲??</p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errData = await resendRes.json();
      console.error("Resend API error:", errData);
      return NextResponse.json({ error: `?몄쬆 硫붿씪 ?꾩넚 ?ㅽ뙣: ${errData.message || JSON.stringify(errData)}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "?몄쬆 ?대찓?쇱씠 諛쒖넚?섏뿀?듬땲??" });
  } catch (error: unknown) {
    console.error("Send verification error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "?쒕쾭 ?대? ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." },
      { status: 500 }
    );
  }
}
