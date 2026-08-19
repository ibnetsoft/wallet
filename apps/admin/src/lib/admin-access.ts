type AdminMetadata = Record<string, unknown> & {
  adminConsole?: boolean;
  adminRole?: string;
  adminPermissions?: unknown;
};

type AdminLikeUser = {
  email?: string | null;
  app_metadata?: AdminMetadata | null;
};

export const DEFAULT_SUBADMIN_PERMISSIONS = ["member.read"] as const;
export const SUPER_ADMIN_ROLE = "SUPER_ADMIN";
export const SUB_ADMIN_RESTRICTED_PAGE_PATHS = [
  "/withdrawals",
  "/wallet",
  "/bnb-transfer",
  "/settings",
] as const;
export const SUB_ADMIN_RESTRICTED_API_PREFIXES = [
  "/api/withdrawals",
  "/api/wallet",
  "/api/bnb-transfer",
  "/api/settings",
] as const;

export function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function configuredAdminEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

export function isConfiguredAdminEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return false;
  }

  return configuredAdminEmails(process.env.ADMIN_EMAILS).includes(normalized);
}

export function getAdminPermissions(metadata: AdminMetadata | null | undefined) {
  if (!Array.isArray(metadata?.adminPermissions)) {
    return [...DEFAULT_SUBADMIN_PERMISSIONS];
  }

  const permissions = metadata.adminPermissions
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  return permissions.length > 0 ? permissions : [...DEFAULT_SUBADMIN_PERMISSIONS];
}

export function isAuthorizedAdmin(user: AdminLikeUser | null | undefined) {
  const email = normalizeEmail(user?.email);
  if (!email) {
    return false;
  }

  if (isConfiguredAdminEmail(email)) {
    return true;
  }

  return user?.app_metadata?.adminConsole === true;
}

export function getAdminRole(user: AdminLikeUser | null | undefined) {
  if (isConfiguredAdminEmail(user?.email)) {
    return SUPER_ADMIN_ROLE;
  }

  const role = user?.app_metadata?.adminRole;
  return typeof role === "string" && role.trim() ? role.trim() : "SUB_ADMIN";
}

export function isSuperAdmin(user: AdminLikeUser | null | undefined) {
  return getAdminRole(user) === SUPER_ADMIN_ROLE;
}

export function isSubAdmin(user: AdminLikeUser | null | undefined) {
  return isAuthorizedAdmin(user) && !isSuperAdmin(user);
}

export function isSubAdminRestrictedPath(pathname: string) {
  return SUB_ADMIN_RESTRICTED_PAGE_PATHS.includes(
    pathname as (typeof SUB_ADMIN_RESTRICTED_PAGE_PATHS)[number]
  );
}

export function isSubAdminRestrictedApiPath(pathname: string) {
  return SUB_ADMIN_RESTRICTED_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
