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
export const ADMIN_PERMISSIONS = {
  MEMBER_READ: "member.read",
  WITHDRAW_MANAGE: "withdraw.manage",
  WALLET_MANAGE: "wallet.manage",
} as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];

const PAGE_PERMISSION_RULES: Array<{
  prefix: string;
  permissions?: AdminPermission[];
  superAdminOnly?: boolean;
}> = [
  { prefix: "/settings", superAdminOnly: true },
  { prefix: "/withdrawals", permissions: [ADMIN_PERMISSIONS.WITHDRAW_MANAGE] },
  { prefix: "/wallet", permissions: [ADMIN_PERMISSIONS.WALLET_MANAGE] },
  { prefix: "/bnb-transfer", permissions: [ADMIN_PERMISSIONS.WALLET_MANAGE] },
];

const API_PERMISSION_RULES: Array<{
  prefix: string;
  permissions?: AdminPermission[];
  superAdminOnly?: boolean;
}> = [
  { prefix: "/api/admins", superAdminOnly: true },
  { prefix: "/api/settings", superAdminOnly: true },
  { prefix: "/api/game-rounds", superAdminOnly: true },
  {
    prefix: "/api/wallet/fee-status",
    permissions: [ADMIN_PERMISSIONS.WITHDRAW_MANAGE, ADMIN_PERMISSIONS.WALLET_MANAGE],
  },
  { prefix: "/api/withdrawals", permissions: [ADMIN_PERMISSIONS.WITHDRAW_MANAGE] },
  { prefix: "/api/wallet", permissions: [ADMIN_PERMISSIONS.WALLET_MANAGE] },
  { prefix: "/api/bnb-transfer", permissions: [ADMIN_PERMISSIONS.WALLET_MANAGE] },
];

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

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function canAccessByRules(
  user: AdminLikeUser | null | undefined,
  pathname: string,
  rules: typeof PAGE_PERMISSION_RULES,
) {
  if (!isAuthorizedAdmin(user)) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  const rule = rules.find(({ prefix }) => matchesPathPrefix(pathname, prefix));
  if (!rule) {
    return true;
  }
  if (rule.superAdminOnly) {
    return false;
  }

  const granted = new Set(getAdminPermissions(user?.app_metadata));
  return rule.permissions?.some((permission) => granted.has(permission)) ?? true;
}

export function canAccessAdminPage(
  user: AdminLikeUser | null | undefined,
  pathname: string,
) {
  return canAccessByRules(user, pathname, PAGE_PERMISSION_RULES);
}

export function canAccessAdminApi(
  user: AdminLikeUser | null | undefined,
  pathname: string,
) {
  return canAccessByRules(user, pathname, API_PERMISSION_RULES);
}
