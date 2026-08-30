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

  if (!isLoginPage && !isCallbackPage) {
    if (!user) {
      // no user, redirect to login
      const url = request.nextUrl.clone();
      url.pathname = adminPath("/login");
      return NextResponse.redirect(url);
    } else {
      if (!isAuthorizedAdmin(user)) {
        // Not an admin
        const url = request.nextUrl.clone();
        url.pathname = adminPath("/login");
        url.searchParams.set("error", "Access Denied. You are not an administrator.");
        
        // Optionally sign out the non-admin user
        // await supabase.auth.signOut();
        
        return NextResponse.redirect(url);
      }

      if (pathname.startsWith("/api/") && !canAccessAdminApi(user, pathname)) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }

      if (!pathname.startsWith("/api/") && !canAccessAdminPage(user, pathname)) {
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
