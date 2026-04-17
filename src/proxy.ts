import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect everything except:
     * - /login
     * - /api/auth (better-auth endpoints)
     * - _next/static, _next/image, favicon
     */
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
