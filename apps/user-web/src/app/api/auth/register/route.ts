import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthToken } from "@/lib/auth-token";
import { ensureMemberWallets } from "@/lib/wallet-generation";

type RegisterTokenPayload = {
  email: string;
  expiresAt: number;
};

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export async function POST(req: Request) {
  try {
    const { token, password, nickname, fullName, phoneNumber, referralCode } = await req.json();

    if (!token || !password || !nickname || !fullName || !phoneNumber) {
      return NextResponse.json(
        { error: "?몄쬆 ?좏겙, 鍮꾨?踰덊샇, ?됰꽕?꾩쓣 紐⑤몢 ?낅젰?댁＜?몄슂." },
        { status: 400 }
      );
    }

    const trimmedFullName = String(fullName).trim();
    const normalizedPhoneNumber = normalizePhoneNumber(String(phoneNumber));

    if (trimmedFullName.length < 2 || trimmedFullName.length > 50) {
      return NextResponse.json({ error: "Invalid full name" }, { status: 400 });
    }

    if (!/^\+?\d{8,15}$/.test(normalizedPhoneNumber)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    let email = "";
    try {
      email = verifyAuthToken<RegisterTokenPayload>(token).email;
    } catch {
      return NextResponse.json({ error: "?좏슚?섏? ?딆? ?몄쬆 ?좏겙?낅땲??" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: existingUsers, error: checkError } = await supabase
      .from("users")
      .select("id")
      .ilike("nickname", nickname)
      .limit(1);

    if (checkError) {
      return NextResponse.json({ error: "DB ?뺤씤 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." }, { status: 500 });
    }

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json({ error: "?대? ?ъ슜 以묒씤 ?됰꽕?꾩엯?덈떎." }, { status: 400 });
    }

    let parentId: string | null = null;
    const masterCodes = ["URC883920", "MASTER"];
    const normalizedReferralCode = String(referralCode ?? "").trim();

    if (normalizedReferralCode.toUpperCase() === "969") {
      const { data: baoUsers, error: baoLookupError } = await supabase
        .from("users")
        .select("id")
        .eq("nickname", "BAO")
        .limit(2);

      if (baoLookupError || baoUsers?.length !== 1) {
        console.error("Default referral lookup error:", baoLookupError);
        return NextResponse.json(
          { error: "Default referral account is unavailable. Please try again later." },
          { status: 503 }
        );
      }

      parentId = baoUsers[0].id;
    } else if (normalizedReferralCode && !masterCodes.includes(normalizedReferralCode.toUpperCase())) {
      let resolvedUser: { id: string } | null = null;

      if (normalizedReferralCode.toUpperCase().startsWith("969-")) {
        const idPart = normalizedReferralCode.substring(4).toLowerCase();
        if (/^[0-9a-f]{8}$/.test(idPart)) {
          // `users.id` is a UUID, so Postgres cannot use LIKE directly on it.
          // Search the UUID range represented by its displayed first 8 hex digits.
          const startId = `${idPart}-0000-0000-0000-000000000000`;
          const nextPrefix = Number.parseInt(idPart, 16) + 1;
          let referralQuery = supabase
            .from("users")
            .select("id")
            .gte("id", startId);

          if (nextPrefix <= 0xffffffff) {
            const endId = `${nextPrefix.toString(16).padStart(8, "0")}-0000-0000-0000-000000000000`;
            referralQuery = referralQuery.lt("id", endId);
          }

          const { data: recById } = await referralQuery.limit(2);
          // Never assign a sponsor arbitrarily if an 8-character prefix collides.
          if (recById?.length === 1) {
            resolvedUser = recById[0] as { id: string };
          }
        }
      }

      if (!resolvedUser) {
        const { data: recommender } = await supabase
          .from("users")
          .select("id")
          .eq("nickname", normalizedReferralCode)
          .single();
        if (recommender) {
          resolvedUser = recommender as { id: string };
        }
      }

      if (!resolvedUser) {
        const { data: recByEmail } = await supabase
          .from("users")
          .select("id")
          .eq("email", normalizedReferralCode)
          .single();
        if (recByEmail) {
          resolvedUser = recByEmail as { id: string };
        }
      }

      if (!resolvedUser) {
        return NextResponse.json({ error: "?좏슚?섏? ?딆? 異붿쿇??肄붾뱶?낅땲?? (留덉뒪??肄붾뱶瑜??ъ슜?섍굅???뺥솗???됰꽕?꾩쓣 ?낅젰?섏꽭??" }, { status: 400 });
      }

      parentId = resolvedUser.id;
    }

    const proxyEmail = `${nickname.toLowerCase()}@sys.hongbou.com`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: proxyEmail,
      password,
      email_confirm: true,
      user_metadata: {
        nickname,
        full_name: trimmedFullName,
        phone_number: normalizedPhoneNumber,
        real_email: email,
      },
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return NextResponse.json({ error: "?쒖뒪???대????대? 議댁옱?섎뒗 ?됰꽕?꾩엯?덈떎." }, { status: 400 });
      }
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    const userId = authData.user.id;
    const insertData: Record<string, unknown> = {
      id: userId,
      email,
      nickname,
      full_name: trimmedFullName,
      phone_number: normalizedPhoneNumber,
      status: "PENDING",
    };

    if (parentId) {
      insertData.parent_id = parentId;
      insertData.recommender_id = parentId;
    }

    const { error: dbError } = await supabase
      .from("users")
      .insert(insertData);

    if (dbError) {
      await supabase.auth.admin.deleteUser(userId);
      console.error("DB Insert Error:", dbError);
      return NextResponse.json({ error: `?좎? ????ㅽ뙣: ${dbError.message || JSON.stringify(dbError)}` }, { status: 500 });
    }

    let walletAddress: string;
    let tronWalletAddress: string;
    try {
      const wallets = await ensureMemberWallets(userId);
      walletAddress = wallets.bsc.address;
      tronWalletAddress = wallets.tron.address;
    } catch (walletError) {
      // A registration is only complete once its deposit address exists.
      // Compensate for the already-created auth and profile records on failure.
      await supabase.from("users").delete().eq("id", userId);
      await supabase.auth.admin.deleteUser(userId);
      console.error("Automatic wallet generation error:", walletError);
      return NextResponse.json(
        { error: "Unable to create a wallet address. Please try signing up again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "?뚯썝媛?낆씠 ?꾨즺?섏뿀?듬땲?? 濡쒓렇???섏씠吏?먯꽌 濡쒓렇?명빐 二쇱꽭??",
      user: {
        id: userId,
        nickname,
        walletAddress,
        tronWalletAddress,
      }
    });
  } catch (error: unknown) {
    console.error("Register API Error:", error);
    return NextResponse.json(
      { error: "?쒕쾭 ?대? ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." },
      { status: 500 }
    );
  }
}
