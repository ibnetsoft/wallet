import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
}

function configuredAdminEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// Route handlers also verify the admin session instead of relying only on the
// proxy, so sensitive member data is never returned on a bypassed route.
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const email = user?.email?.trim().toLowerCase();
  const adminEmails = configuredAdminEmails(process.env.ADMIN_EMAILS);

  if (error || !user || !email || !adminEmails.includes(email)) {
    return null;
  }

  return { id: user.id, email };
}
