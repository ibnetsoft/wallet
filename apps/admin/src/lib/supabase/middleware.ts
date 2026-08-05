import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
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
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  const isCallbackPage = request.nextUrl.pathname.startsWith("/api/auth/callback");

  if (!isLoginPage && !isCallbackPage) {
    if (!user) {
      // no user, redirect to login
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    } else {
      // Check if user is in ADMIN_EMAILS
      const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
      if (user.email && !adminEmails.includes(user.email.toLowerCase())) {
        // Not an admin
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "Access Denied. You are not an administrator.");
        
        // Optionally sign out the non-admin user
        // await supabase.auth.signOut();
        
        return NextResponse.redirect(url);
      }
    }
  }

  // If user is logged in and tries to access /login, redirect to /
  if (user && isLoginPage) {
    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
    if (user.email && adminEmails.includes(user.email.toLowerCase())) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
