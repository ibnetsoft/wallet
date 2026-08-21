import { createClient } from "@/lib/supabase/server";
import { getAdminRole, isAuthorizedAdmin, normalizeEmail } from "@/lib/admin-access";

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

// Route handlers also verify the admin session instead of relying only on the
// proxy, so sensitive member data is never returned on a bypassed route.
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const email = normalizeEmail(user?.email);

  if (error || !user || !email || !isAuthorizedAdmin(user)) {
    return null;
  }

  return {
    id: user.id,
    email,
    role: getAdminRole(user),
    permissions: Array.isArray(user.app_metadata?.adminPermissions)
      ? user.app_metadata.adminPermissions.filter((value): value is string => typeof value === "string")
      : [],
  };
}
