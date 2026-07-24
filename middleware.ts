import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const kidAllowedExactPaths = new Set([
  "/today",
  "/dashboard",
  // The kid week view is read-mostly; every write it can reach still routes
  // through the approval queue (lib/actions/completions.ts).
  "/week",
  "/calendar",
  "/booklists",
  // Kids keep their own reading log; the action scopes writes to their own
  // student record (lib/actions/reading.ts).
  "/reading",
  "/login",
]);

const kidAllowedPrefixes = [
  "/lessons/",
  "/week/",
  "/api/calendar",
  "/api/lessons",
  "/api/auth",
];

function isKidAllowedPath(pathname: string) {
  if (kidAllowedExactPaths.has(pathname)) return true;
  return kidAllowedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (token?.role === "kid" && !isKidAllowedPath(pathname)) {
      return NextResponse.redirect(new URL("/today", req.url));
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
    "/((?!login|signup|api/auth|api/cron|api/webhooks|api/calendar/ical|api/signup-status|manifest.webmanifest|icon.svg|_next/static|_next/image|favicon.ico|uploads).*)",
  ],
};
