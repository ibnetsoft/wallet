type AdminMetadata = {
  adminConsole?: boolean;
  adminRole?: string;
  adminPermissions?: unknown;
};

type AdminLikeUser = {
  email?: string | null;
  app_metadata?: AdminMetadata | null;
};

export const DEFAULT_SUBADMIN_PERMISSIONS = ["member.read"] as const;

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
    return "SUPER_ADMIN";
  }

  const role = user?.app_metadata?.adminRole;
  return typeof role === "string" && role.trim() ? role.trim() : "SUB_ADMIN";
}
