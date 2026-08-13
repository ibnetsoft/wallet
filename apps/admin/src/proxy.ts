import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // The route handlers require either an authenticated admin or a signed cron
  // request. Skip session refresh so the signed scheduler request can reach it.
  if (pathname.startsWith("/api/cron/") || pathname === "/api/game-rounds/draw") {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
