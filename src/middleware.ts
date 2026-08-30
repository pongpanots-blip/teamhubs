import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Only gates /app on cookie ABSENCE — a cheap, edge-safe check with no DB round trip.
 * It must never redirect /login or /register away based on cookie PRESENCE: that cookie
 * may be stale (e.g. its session row was deleted), and the authoritative getSession()
 * check on those pages would then redirect back here, forming a loop with this middleware
 * bouncing back to /app. The "already logged in, skip login page" redirect instead lives
 * in the login/register pages themselves, which can verify the session for real.
 */
export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  const isApp = pathname.startsWith("/app");

  if (isApp && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
