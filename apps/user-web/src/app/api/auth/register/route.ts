import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { email, password, nickname, referralCode } = await req.json();

    if (!email || !password || !nickname) {
      return NextResponse.json(
        { error: "이메일, 비밀번호, 닉네임을 모두 입력해주세요." },
        { status: 400 }
      );
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
    if (referralCode) {
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
          return NextResponse.json({ error: "유효하지 않은 추천인 코드입니다." }, { status: 400 });
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
      email_confirm: true, // 이메일 인증 우회
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
    const { error: dbError } = await supabase
      .from("users")
      .insert({
        id: userId,
        email: email,
        nickname: nickname,
        recommender_id: recommenderId,
        parent_id: parentId, // For legacy support
        status: "PENDING",
      });

    if (dbError) {
      // 롤백 (Auth 유저 삭제)
      await supabase.auth.admin.deleteUser(userId);
      console.error("DB Insert Error:", dbError);
      return NextResponse.json({ error: "유저 정보 저장 중 오류가 발생했습니다. 다시 시도해주세요." }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "가입이 완료되었습니다.",
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
