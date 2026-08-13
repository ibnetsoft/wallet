import { createClient } from "@/lib/supabase/server";

export interface AdminIdentity {
  id: string;
  email: string;
}

function parseEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verifies the server-side Supabase session again inside sensitive route
 * handlers. Middleware protects navigation, but wallet operations must not
 * rely on middleware alone.
 */
export async function getVerifiedAdmin(
  allowedEmailsEnv = "ADMIN_EMAILS"
): Promise<AdminIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const email = user?.email?.trim().toLowerCase();
  if (error || !user || !email) {
    return null;
  }

  // Route handlers must enforce the platform admin list themselves rather
  // than relying only on middleware. A transfer-specific list can narrow,
  // but never expand, that authority.
  const admins = parseEmails(process.env.ADMIN_EMAILS);
  if (admins.length === 0 || !admins.includes(email)) {
    return null;
  }

  if (allowedEmailsEnv !== "ADMIN_EMAILS") {
    const scopedAdmins = parseEmails(process.env[allowedEmailsEnv]);
    if (scopedAdmins.length > 0 && !scopedAdmins.includes(email)) {
      return null;
    }
  }

  return { id: user.id, email };
}
