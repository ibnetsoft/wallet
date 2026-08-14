import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuthToken } from "@/lib/auth-token";

type RegisterTokenPayload = {
  email: string;
  expiresAt: number;
};

function getUuidPrefixBounds(prefix: string) {
  if (!/^[0-9a-f]{8}$/i.test(prefix)) {
    return null;
  }

  const normalized = prefix.toLowerCase();
  const lowerBound = `${normalized}-0000-0000-0000-000000000000`;

  // UUID values can be compared directly, unlike a UUID column with LIKE.
  // There is no upper bound after the largest possible eight-character prefix.
  if (normalized === "ffffffff") {
    return { lowerBound, upperBound: null };
  }

  const nextPrefix = (Number.parseInt(normalized, 16) + 1)
    .toString(16)
    .padStart(8, "0");

  return {
    lowerBound,
    upperBound: `${nextPrefix}-0000-0000-0000-000000000000`,
  };
}

export async function POST(req: Request) {
  try {
    const { token, password, nickname, referralCode } = await req.json();

    if (!token || !password || !nickname) {
      return NextResponse.json(
        { error: "?몄쬆 ?좏겙, 鍮꾨?踰덊샇, ?됰꽕?꾩쓣 紐⑤몢 ?낅젰?댁＜?몄슂." },
        { status: 400 }
      );
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

    const normalizedReferralCode = typeof referralCode === "string" ? referralCode.trim() : "";
    let parentId: string | null = null;
    const masterCodes = ["URC883920", "BAO369", "MASTER"];

    if (normalizedReferralCode && !masterCodes.includes(normalizedReferralCode.toUpperCase())) {
      let resolvedUser: { id: string } | null = null;

      if (normalizedReferralCode.toUpperCase().startsWith("BAO-")) {
        const bounds = getUuidPrefixBounds(normalizedReferralCode.substring(4));
        if (bounds) {
          let lookup = supabase
            .from("users")
            .select("id")
            .gte("id", bounds.lowerBound)
            .order("id", { ascending: true })
            .limit(2);

          if (bounds.upperBound) {
            lookup = lookup.lt("id", bounds.upperBound);
          }

          const { data: recById, error: lookupError } = await lookup;
          if (lookupError) {
            return NextResponse.json({ error: "Referral code lookup failed." }, { status: 500 });
          }

          // An eight-character UUID prefix should be unique. Do not attach a
          // new member to an arbitrary account if a collision ever occurs.
          if (recById && recById.length > 1) {
            return NextResponse.json({ error: "Referral code is ambiguous." }, { status: 400 });
          }
          if (recById && recById.length === 1) {
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

    return NextResponse.json({
      success: true,
      message: "?뚯썝媛?낆씠 ?꾨즺?섏뿀?듬땲?? 濡쒓렇???섏씠吏?먯꽌 濡쒓렇?명빐 二쇱꽭??",
      user: {
        id: userId,
        nickname
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
