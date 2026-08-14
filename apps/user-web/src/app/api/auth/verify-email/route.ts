import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth-token";
import { emailMessage, resolveEmailLocale } from "@/lib/email-templates";

type VerifyEmailTokenPayload = {
  email: string;
  locale?: string;
  expiresAt: number;
};

export async function GET(req: Request) {
  const requestLocale = resolveEmailLocale(undefined, req.headers.get("accept-language"));

  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return new NextResponse(emailMessage(requestLocale, "invalidVerificationRequest"), { status: 400 });
    }

    try {
      const { email, locale } = verifyAuthToken<VerifyEmailTokenPayload>(token);
      const redirectUrl = new URL("/register", req.url);
      redirectUrl.searchParams.set("email", email);
      redirectUrl.searchParams.set("verified", "true");
      redirectUrl.searchParams.set("token", token);
      redirectUrl.searchParams.set("locale", resolveEmailLocale(locale, req.headers.get("accept-language")));

      return NextResponse.redirect(redirectUrl);
    } catch {
      return new NextResponse(emailMessage(requestLocale, "invalidVerificationToken"), { status: 400 });
    }
  } catch (error: unknown) {
    console.error("Verify Email Error:", error);
    return new NextResponse(emailMessage(requestLocale, "serverError"), { status: 500 });
  }
}
