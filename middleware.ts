import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const kidAllowedExactPaths = new Set([
  "/dashboard",
  "/calendar",
  "/booklists",
  "/login",
]);

const kidAllowedPrefixes = ["/lessons/", "/api/calendar", "/api/lessons", "/api/auth"];

function isKidAllowedPath(pathname: string) {
  if (kidAllowedExactPaths.has(pathname)) return true;
  return kidAllowedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (token?.role === "kid" && !isKidAllowedPath(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    // Protect all routes except login, api/auth, and static files
    "/((?!login|api/auth|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
