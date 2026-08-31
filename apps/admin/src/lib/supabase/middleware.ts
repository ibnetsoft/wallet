import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  canAccessAdminApi,
  canAccessAdminPage,
  isAuthorizedAdmin,
} from "@/lib/admin-access";
import { adminPath, stripAdminBasePath } from "@/lib/admin-path";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });
  const pathname = stripAdminBasePath(request.nextUrl.pathname);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach((cookie) => request.cookies.set(cookie.name, cookie.value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect all routes except /login and /api/auth/callback
  const isLoginPage = pathname.startsWith("/login");
  const isCallbackPage = pathname.startsWith("/api/auth/callback");
  const isApiRequest = pathname.startsWith("/api/");

  if (!isLoginPage && !isCallbackPage) {
    if (!user) {
      if (isApiRequest) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = adminPath("/login");
      return NextResponse.redirect(url);
    } else {
      if (!isAuthorizedAdmin(user)) {
        if (isApiRequest) {
          return NextResponse.json(
            { success: false, error: "Access Denied. You are not an administrator." },
            { status: 403 }
          );
        }

        const url = request.nextUrl.clone();
        url.pathname = adminPath("/login");
        url.searchParams.set("error", "Access Denied. You are not an administrator.");
        return NextResponse.redirect(url);
      }

      if (isApiRequest && !canAccessAdminApi(user, pathname)) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }

      if (!isApiRequest && !canAccessAdminPage(user, pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = adminPath("/");
        url.searchParams.set("access", "denied");
        return NextResponse.redirect(url);
      }
    }
  }

  // If user is logged in and tries to access /login, redirect to /
  if (user && isLoginPage) {
    if (isAuthorizedAdmin(user)) {
      const url = request.nextUrl.clone();
      url.pathname = adminPath("/");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
