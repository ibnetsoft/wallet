import { createClient } from "@/lib/supabase/server";

export interface BnbTransferAdmin {
  id: string;
  email: string;
}

function parseEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// This check is intentionally local to the isolated BNB transfer feature.
// It never changes the authorization behavior of existing admin pages or APIs.
export async function getBnbTransferAdmin(): Promise<BnbTransferAdmin | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const email = user?.email?.trim().toLowerCase();
  if (error || !user || !email) {
    return null;
  }

  const adminEmails = parseEmails(process.env.ADMIN_EMAILS);
  if (adminEmails.length === 0 || !adminEmails.includes(email)) {
    return null;
  }

  // An optional BNB-specific list can narrow access but cannot grant access to
  // anyone who is not already an administrator.
  const bnbTransferAdmins = parseEmails(process.env.BNB_TRANSFER_ADMIN_EMAILS);
  if (bnbTransferAdmins.length > 0 && !bnbTransferAdmins.includes(email)) {
    return null;
  }

  return { id: user.id, email };
}
