import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

// Routes that require authentication
const protectedRoutes = ["/library", "/series", "/activity", "/settings", "/scan", "/admin"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const token = request.cookies.get("session")?.value;

  let session = null;
  if (token) {
    session = await verifyToken(token);
  }

  // Login remains reachable so a revoked or expired server-side session can be renewed.

  // Redirect unauthenticated users to login
  if (!session && protectedRoutes.some((route) => path.startsWith(route))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(loginUrl);
  }

  // Check admin access
  if (path.startsWith("/admin") && session?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/library", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (they handle their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
