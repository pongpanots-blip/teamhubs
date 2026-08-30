import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Cookie presence ≠ valid session. Only gate /app here.
  // Do not bounce /login|/register → /app on cookie alone — that loops when
  // the cookie is stale and the page redirects back to /login.
  if (pathname.startsWith("/app") && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/register", "/onboarding"],
};
