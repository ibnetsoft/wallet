import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: "필수 데이터가 누락되었습니다." }, { status: 400 });
    }

    const [dataStr, signature] = token.split(".");
    if (!dataStr || !signature) {
      return NextResponse.json({ error: "올바르지 않은 토큰 형식입니다." }, { status: 400 });
    }

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "default-secret-key";
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(dataStr)
      .digest("base64url");

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: "토큰 인증 서명이 올바르지 않습니다." }, { status: 400 });
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(dataStr, "base64url").toString("utf8"));
    } catch (e) {
      return NextResponse.json({ error: "토큰 디코딩에 실패했습니다." }, { status: 400 });
    }

    const { userId, expiresAt } = payload;

    if (!userId || !expiresAt) {
      return NextResponse.json({ error: "유효하지 않은 토큰 데이터입니다." }, { status: 400 });
    }

    if (expiresAt < Date.now()) {
      return NextResponse.json({ error: "재설정 링크가 만료되었습니다. 다시 요청해 주세요." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Supabase Auth 비밀번호 업데이트
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (authError) {
      console.error("Auth password reset error:", authError);
      return NextResponse.json({ error: `비밀번호 업데이트 실패: ${authError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "비밀번호가 성공적으로 재설정되었습니다." });
  } catch (error: any) {
    console.error("Reset password confirm error:", error);
    return NextResponse.json({ error: "서버 내부 오류가 발생했습니다." }, { status: 500 });
  }
}
