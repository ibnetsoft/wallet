export const ADMIN_BASE_PATH = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || "/admin";

function normalizePath(path: string) {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }

  return path;
}

export function adminPath(path: string) {
  const normalizedPath = normalizePath(path);

  if (normalizedPath === ADMIN_BASE_PATH || normalizedPath.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return stripAdminBasePath(normalizedPath);
  }

  return normalizedPath;
}

export function adminRedirectPath(path: string) {
  const normalizedPath = normalizePath(path);

  if (normalizedPath === ADMIN_BASE_PATH || normalizedPath.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return normalizedPath;
  }

  return normalizedPath === "/" ? ADMIN_BASE_PATH : `${ADMIN_BASE_PATH}${normalizedPath}`;
}

export function adminApi(path: string) {
  const normalizedPath = normalizePath(path);

  if (normalizedPath === ADMIN_BASE_PATH || normalizedPath.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return normalizedPath;
  }

  return normalizedPath === "/" ? ADMIN_BASE_PATH : `${ADMIN_BASE_PATH}${normalizedPath}`;
}

export function stripAdminBasePath(pathname: string) {
  let normalizedPathname = normalizePath(pathname);

  while (normalizedPathname === ADMIN_BASE_PATH || normalizedPathname.startsWith(`${ADMIN_BASE_PATH}/`)) {
    if (normalizedPathname === ADMIN_BASE_PATH) {
      normalizedPathname = "/";
      break;
    }

    normalizedPathname = normalizedPathname.slice(ADMIN_BASE_PATH.length);
  }

  return normalizedPathname;
}
