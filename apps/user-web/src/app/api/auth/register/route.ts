import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { token, password, nickname, referralCode } = await req.json();

    if (!token || !password || !nickname) {
      return NextResponse.json(
        { error: "인증 토큰, 비밀번호, 닉네임을 모두 입력해주세요." },
        { status: 400 }
      );
    }

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "default-secret-key";

    // 1. 토큰 해독 및 이메일 주소 추출
    const [dataStr, signature] = token.split(".");
    if (!dataStr || !signature) {
      return NextResponse.json({ error: "유효하지 않은 인증 토큰 형식입니다." }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(dataStr)
      .digest("base64url");

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: "인증 토큰의 서명이 위조되었습니다." }, { status: 400 });
    }

    let payload: any;
    try {
      payload = JSON.parse(Buffer.from(dataStr, "base64url").toString("utf8"));
    } catch (e) {
      return NextResponse.json({ error: "인증 토큰 해독에 실패했습니다." }, { status: 400 });
    }

    const { email, expiresAt } = payload;
    if (!email || !expiresAt) {
      return NextResponse.json({ error: "토큰 내 필수 정보가 누락되었습니다." }, { status: 400 });
    }

    if (expiresAt < Date.now()) {
      return NextResponse.json({ error: "이메일 인증 기한(15분)이 만료되었습니다. 다시 이메일 인증을 진행해 주세요." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. 닉네임 중복 체크 (대소문자 구분 없이)
    const { data: existingUsers, error: checkError } = await supabase
      .from("users")
      .select("id")
      .ilike("nickname", nickname)
      .limit(1);

    if (checkError) {
      return NextResponse.json({ error: "DB 확인 중 오류가 발생했습니다." }, { status: 500 });
    }

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 400 });
    }

    // 2. 추천인 체크 (선택)
    let recommenderId = null;
    let parentId = null;
    
    // 최초 최상위 계정 생성을 위한 마스터 코드 예외 처리
    const masterCodes = ["URC883920", "BAO369", "MASTER"];
    
    if (referralCode && !masterCodes.includes(referralCode.toUpperCase())) {
      const { data: recommender, error: recError } = await supabase
        .from("users")
        .select("id")
        .eq("nickname", referralCode)
        .single();
        
      if (recError || !recommender) {
        // Fallback: Check if referral code is an email (for legacy support during transition)
        const { data: recByEmail } = await supabase
          .from("users")
          .select("id")
          .eq("email", referralCode)
          .single();
          
        if (recByEmail) {
          recommenderId = recByEmail.id;
          parentId = recByEmail.id;
        } else {
          return NextResponse.json({ error: "유효하지 않은 추천인 코드입니다. (마스터 코드를 사용하거나 정확한 닉네임을 입력하세요)" }, { status: 400 });
        }
      } else {
        recommenderId = recommender.id;
        parentId = recommender.id;
      }
    }

    // 3. 가상 이메일 생성 (닉네임 기반 고유 이메일)
    const proxyEmail = `${nickname.toLowerCase()}@sys.hongbou.com`;

    // 4. Supabase Auth 사용자 생성 (Admin API 사용)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: proxyEmail,
      password: password,
      email_confirm: true, // 이메일 인증 완료된 토큰을 받았으므로 즉시 활성화(인증됨) 처리
      user_metadata: {
        nickname: nickname,
        real_email: email,
      },
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return NextResponse.json({ error: "시스템 내부에 이미 존재하는 닉네임입니다." }, { status: 400 });
      }
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const userId = authData.user.id;

    // 5. public.users 에 레코드 강제 생성
    // email 컬러에는 진짜 이메일(real_email)을 넣음. (이제 DB에서 UNIQUE가 아니므로 중복 가능)
    // parent_id만 사용 (recommender_id는 DB에 없을 수 있음)
    const insertData: Record<string, any> = {
      id: userId,
      email: email,
      nickname: nickname,
      status: "PENDING",
    };
    if (parentId) {
      insertData.parent_id = parentId;
    }

    const { error: dbError } = await supabase
      .from("users")
      .insert(insertData);

    if (dbError) {
      // 롤백 (Auth 유저 삭제)
      await supabase.auth.admin.deleteUser(userId);
      console.error("DB Insert Error:", dbError);
      return NextResponse.json({ error: `유저 저장 실패: ${dbError.message || JSON.stringify(dbError)}` }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "회원가입이 완료되었습니다. 로그인 페이지에서 로그인해 주세요.",
      user: {
        id: userId,
        nickname: nickname
      }
    });
  } catch (error: any) {
    console.error("Register API Error:", error);
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
