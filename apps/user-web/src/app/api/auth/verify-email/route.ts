import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth-token";

type VerifyEmailTokenPayload = {
  email: string;
  expiresAt: number;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return new NextResponse("?좏슚?섏? ?딆? ?붿껌?낅땲?? (?좏겙 ?놁쓬)", { status: 400 });
    }

    try {
      const { email } = verifyAuthToken<VerifyEmailTokenPayload>(token);
      const proto = req.headers.get("x-forwarded-proto") || "http";
      const host = req.headers.get("host") || "localhost:3000";

      return NextResponse.redirect(
        `${proto}://${host}/register?email=${encodeURIComponent(email)}&verified=true&token=${token}`
      );
    } catch {
      return new NextResponse("?좏슚?섏? ?딆? ?몄쬆 ?좏겙?낅땲??", { status: 400 });
    }
  } catch (error: unknown) {
    console.error("Verify Email Error:", error);
    return new NextResponse("?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.", { status: 500 });
  }
}
