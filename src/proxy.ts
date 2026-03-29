import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const sessionCookie =
    request.cookies.get("better-auth.session_token")?.value;

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
