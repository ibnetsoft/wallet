import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

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
      email_confirm: false, // 이메일 인증 활성화 (인증 링크 클릭 후 로그인 가능)
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

    // 6. 이메일 인증 링크 생성 및 발송 (Resend API 사용)
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      // 롤백 (DB 유저 및 Auth 유저 삭제)
      await supabase.from("users").delete().eq("id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "서버의 이메일 전송 API Key(RESEND_API_KEY) 설정이 되어 있지 않습니다." }, { status: 500 });
    }

    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "default-secret-key";
    const payload = { userId, email, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
    const dataStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(dataStr)
      .digest("base64url");
    const token = `${dataStr}.${signature}`;

    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "localhost:3000";
    const confirmLink = `${proto}://${host}/api/auth/confirm-email?token=${token}`;

    const fromEmail = process.env.EMAIL_FROM || "BAO369 <onboarding@resend.dev>";

    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: "[BAO369] 회원가입 이메일 인증 안내",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #FCD535; background-color: #0B0E11; padding: 15px; text-align: center; border-radius: 8px;">BAO369 이메일 인증</h2>
              <p>안녕하세요, <strong>${nickname}</strong>님!</p>
              <p>BAO369 서비스 가입을 환영합니다. 아래 버튼을 클릭하여 이메일 주소 인증을 완료해 주세요.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmLink}" style="background-color: #FCD535; color: #0B0E11; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">이메일 인증 완료하기</a>
              </div>
              <p style="color: #666; font-size: 12px;">이 링크는 24시간 동안 유효합니다. 가입 요청을 하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
            </div>
          `,
        }),
      });

      if (!resendRes.ok) {
        const errData = await resendRes.json();
        console.error("Resend API error:", errData);
        // 롤백 (DB 유저 및 Auth 유저 삭제)
        await supabase.from("users").delete().eq("id", userId);
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: `인증 메일 전송 실패: ${errData.message || JSON.stringify(errData)}` }, { status: 500 });
      }
    } catch (emailErr: any) {
      console.error("Resend fetch error:", emailErr);
      // 롤백 (DB 유저 및 Auth 유저 삭제)
      await supabase.from("users").delete().eq("id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `인증 메일 전송 중 오류 발생: ${emailErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "가입이 완료되었습니다. 이메일로 인증 메일이 발송되었으니 확인해 주세요.",
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
