import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user = null;

  if (!supabaseUrl || !supabaseKey || supabaseKey.includes("YOUR_SUPABASE_ANON_KEY") || supabaseUrl.includes("placeholder-project")) {
    const mockSession = request.cookies.get("sb-mock-session")?.value;
    if (mockSession) {
      user = { id: "f0e5d88f-3496-4415-8933-4a7359ba6232", email: mockSession };
    }
  } else {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseKey,
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

    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  const publicRoutes = ["/login", "/register", "/auth/callback"];
  const isPublicRoute = publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route));

  // If user is not logged in and tries to access a protected route
  if (!user && !isPublicRoute && !request.nextUrl.pathname.startsWith("/_next") && !request.nextUrl.pathname.startsWith("/api")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user is logged in and tries to access login/register pages
  if (user && isPublicRoute && !request.nextUrl.pathname.startsWith("/auth/callback")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
