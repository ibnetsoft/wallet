export const ADMIN_BASE_PATH = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || "/admin";

export function adminPath(path: string) {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  if (path === ADMIN_BASE_PATH || path.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return path;
  }

  return path === "/" ? ADMIN_BASE_PATH : `${ADMIN_BASE_PATH}${path}`;
}

export function adminApi(path: string) {
  return adminPath(path);
}

export function stripAdminBasePath(pathname: string) {
  if (pathname === ADMIN_BASE_PATH) {
    return "/";
  }

  if (pathname.startsWith(`${ADMIN_BASE_PATH}/`)) {
    return pathname.slice(ADMIN_BASE_PATH.length);
  }

  return pathname;
}
