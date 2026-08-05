import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return new NextResponse("유효하지 않은 요청입니다. (토큰 없음)", { status: 400 });
    }

    const [dataStr, signature] = token.split(".");
    if (!dataStr || !signature) {
      return new NextResponse("올바르지 않은 인증 토큰 형식입니다.", { status: 400 });
    }

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "default-secret-key";
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(dataStr)
      .digest("base64url");

    if (signature !== expectedSignature) {
      return new NextResponse("인증 서명이 일치하지 않거나 변조되었습니다.", { status: 400 });
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(dataStr, "base64url").toString("utf8"));
    } catch (e) {
      return new NextResponse("토큰 데이터 디코딩에 실패했습니다.", { status: 400 });
    }

    const { userId, expiresAt } = payload;

    if (!userId || !expiresAt) {
      return new NextResponse("필수 정보가 누락된 토큰입니다.", { status: 400 });
    }

    if (expiresAt < Date.now()) {
      return new NextResponse("인증 링크가 만료되었습니다. 다시 회원가입을 시도하거나 이메일 인증을 재요청해주세요.", { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Supabase Auth 유저의 email_confirm을 true로 변경
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true
    });

    if (authError) {
      console.error("Auth confirm error:", authError);
      return new NextResponse(`인증 처리 중 오류가 발생했습니다: ${authError.message}`, { status: 500 });
    }

    // 2. 로그인 페이지로 리다이렉트
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    
    return NextResponse.redirect(`${proto}://${host}/login?verified=true`);
  } catch (error: any) {
    console.error("Confirm Email Error:", error);
    return new NextResponse("서버 오류가 발생했습니다.", { status: 500 });
  }
}
