import { NextResponse } from "next/server";
import { signAuthToken } from "@/lib/auth-token";
import {
  createVerificationEmail,
  emailMessage,
  resolveEmailLocale,
  type EmailLocale,
} from "@/lib/email-templates";

export async function POST(req: Request) {
  let locale: EmailLocale = resolveEmailLocale(undefined, req.headers.get("accept-language"));

  try {
    const body = (await req.json()) as { email?: unknown; locale?: unknown };
    locale = resolveEmailLocale(body.locale, req.headers.get("accept-language"));
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: emailMessage(locale, "missingEmail") }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: emailMessage(locale, "emailServiceUnavailable") }, { status: 500 });
    }

    const token = signAuthToken({ email, locale, expiresAt: Date.now() + 15 * 60 * 1000 });
    const confirmUrl = new URL("/api/auth/verify-email", req.url);
    confirmUrl.searchParams.set("token", token);
    const template = createVerificationEmail(locale, confirmUrl.toString());

    const fromEmail = process.env.EMAIL_FROM || "969 <onboarding@resend.dev>";

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      }),
    });

    if (!resendRes.ok) {
      console.error("Resend API error:", await resendRes.text());
      return NextResponse.json({ error: emailMessage(locale, "verificationSendFailed") }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: emailMessage(locale, "verificationSent") });
  } catch (error: unknown) {
    console.error("Send verification error:", error);
    return NextResponse.json(
      { error: emailMessage(locale, "serverError") },
      { status: 500 }
    );
  }
}
