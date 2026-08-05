import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { nickname } = await req.json();
    if (!nickname) {
      return NextResponse.json({ error: "닉네임을 입력해 주세요." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 닉네임으로 유저 찾기 (대소문자 구분 없이)
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, nickname")
      .ilike("nickname", nickname.trim())
      .limit(1)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: "존재하지 않는 닉네임입니다." }, { status: 404 });
    }

    const userId = user.id;
    const realEmail = user.email;

    // 토큰 생성 (15분 만료)
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "default-secret-key";
    const payload = { userId, expiresAt: Date.now() + 15 * 60 * 1000 };
    const dataStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(dataStr)
      .digest("base64url");
    const token = `${dataStr}.${signature}`;

    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const resetLink = `${proto}://${host}/reset-password?token=${token}`;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: "서버 이메일 설정(RESEND_API_KEY)이 누락되었습니다." }, { status: 500 });
    }

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
        to: realEmail,
        subject: "[BAO369] 비밀번호 재설정 안내",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #FCD535; background-color: #0B0E11; padding: 15px; text-align: center; border-radius: 8px;">BAO369 비밀번호 재설정</h2>
            <p>안녕하세요, <strong>${user.nickname}</strong>님!</p>
            <p>비밀번호를 재설정하려면 아래 버튼을 클릭해 주세요. 본인이 요청하지 않으셨다면 이 메일을 무시하셔도 안전합니다.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #FCD535; color: #0B0E11; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">비밀번호 재설정하기</a>
            </div>
            <p style="color: #666; font-size: 12px;">이 링크는 15분 동안만 유효합니다.</p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errData = await resendRes.json();
      return NextResponse.json({ error: `메일 전송 실패: ${errData.message || JSON.stringify(errData)}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "비밀번호 재설정 링크가 이메일로 발송되었습니다." });
  } catch (error: any) {
    console.error("Reset password request error:", error);
    return NextResponse.json({ error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
  }
}
