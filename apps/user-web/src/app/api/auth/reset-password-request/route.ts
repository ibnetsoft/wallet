import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signAuthToken } from "@/lib/auth-token";
import {
  createPasswordResetEmail,
  emailMessage,
  resolveEmailLocale,
  type EmailLocale,
} from "@/lib/email-templates";

export async function POST(req: Request) {
  let locale: EmailLocale = resolveEmailLocale(undefined, req.headers.get("accept-language"));

  try {
    const body = (await req.json()) as { nickname?: unknown; locale?: unknown };
    locale = resolveEmailLocale(body.locale, req.headers.get("accept-language"));
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";

    if (!nickname) {
      return NextResponse.json({ error: emailMessage(locale, "missingNickname") }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email, nickname")
      .ilike("nickname", nickname)
      .limit(1)
      .maybeSingle();

    if (userError || !user) {
      return NextResponse.json({ error: emailMessage(locale, "userNotFound") }, { status: 404 });
    }

    const token = signAuthToken({ userId: user.id, expiresAt: Date.now() + 15 * 60 * 1000 });
    const resetUrl = new URL("/reset-password", req.url);
    resetUrl.searchParams.set("token", token);
    const template = createPasswordResetEmail(locale, resetUrl.toString(), user.nickname);

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ error: emailMessage(locale, "emailServiceUnavailable") }, { status: 500 });
    }

    const fromEmail = process.env.EMAIL_FROM || "969 <onboarding@resend.dev>";
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      }),
    });

    if (!resendRes.ok) {
      console.error("Resend API error:", await resendRes.text());
      return NextResponse.json({ error: emailMessage(locale, "passwordResetSendFailed") }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: emailMessage(locale, "passwordResetSent") });
  } catch (error: unknown) {
    console.error("Reset password request error:", error);
    return NextResponse.json(
      { error: emailMessage(locale, "serverError") },
      { status: 500 }
    );
  }
}
