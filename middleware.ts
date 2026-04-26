import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // `camera=()` blocks all camera use; use `(self)` so same-origin pages can call getUserMedia.
  res.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=()",
  );

  // Very light rate hint for API (Vercel WAF / Redis recommended for production)
  if (req.nextUrl.pathname.startsWith("/api/")) {
    res.headers.set("X-Store-API", "1");
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
