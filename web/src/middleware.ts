import { NextRequest, NextResponse } from "next/server";

// Capa extra de UX: redirige a /login si no hay cookie. La seguridad real está en cada endpoint (withAuth).
export function middleware(req: NextRequest) {
  if (!req.cookies.get("bs_token")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!api|_next|login|favicon.ico).*)"] };
