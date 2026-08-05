import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "이메일 주소를 입력해 주세요." }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: "서버 이메일 설정(RESEND_API_KEY)이 누락되었습니다." }, { status: 500 });
    }

    // 토큰 생성 (15분 만료)
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "default-secret-key";
    const payload = { email, expiresAt: Date.now() + 15 * 60 * 1000 };
    const dataStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(dataStr)
      .digest("base64url");
    const token = `${dataStr}.${signature}`;

    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const confirmLink = `${proto}://${host}/api/auth/verify-email?token=${token}`;

    const fromEmail = process.env.EMAIL_FROM || "BAO369 <onboarding@resend.dev>";

    // 이메일 발송
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: "[BAO369] 회원가입을 위한 이메일 인증 안내",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #FCD535; background-color: #0B0E11; padding: 15px; text-align: center; border-radius: 8px;">BAO369 이메일 인증</h2>
            <p>안녕하세요!</p>
            <p>BAO369 회원가입을 계속하려면 아래 버튼을 클릭하여 이메일 주소 인증을 완료해 주세요.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmLink}" style="background-color: #FCD535; color: #0B0E11; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">이메일 인증 완료하기</a>
            </div>
            <p style="color: #666; font-size: 12px;">이 링크는 15분 동안만 유효합니다. 가입 요청을 하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errData = await resendRes.json();
      console.error("Resend API error:", errData);
      return NextResponse.json({ error: `인증 메일 전송 실패: ${errData.message || JSON.stringify(errData)}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "인증 이메일이 발송되었습니다." });
  } catch (error: any) {
    console.error("Send verification error:", error);
    return NextResponse.json({ error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
  }
}
