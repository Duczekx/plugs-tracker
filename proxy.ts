import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRoleFromRequest } from "@/lib/role-auth";

const PUBLIC_FILE = /\.(.*)$/;
const PUBLIC_PATHS = new Set([
  "/login",
  "/viewer",
  "/editor",
  "/review",
  "/api/login",
  "/api/role-login",
  "/api/role-logout",
  "/api/role/me",
]);
const STATIC_PREFIXES = ["/_next", "/icons"];
const STATIC_FILES = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/sw.js",
  "/robots.txt",
  "/sitemap.xml",
]);

const isStaticAsset = (pathname: string) => {
  if (STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (STATIC_FILES.has(pathname)) {
    return true;
  }
  return PUBLIC_FILE.test(pathname);
};

export const proxy = async (request: NextRequest) => {
  const { pathname, search } = request.nextUrl;

  if (isStaticAsset(pathname) || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const role = await getRoleFromRequest(request);
    if (role === "VIEWER") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    const role = await getRoleFromRequest(request);
    if (!role) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (pathname.startsWith("/api/push")) {
      return NextResponse.next();
    }
    const method = request.method.toUpperCase();
    if (role === "VIEWER" && !["GET", "HEAD", "OPTIONS"].includes(method)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  const role = await getRoleFromRequest(request);
  if (role) {
    return NextResponse.next();
  }

  const viewerUrl = request.nextUrl.clone();
  viewerUrl.pathname = "/viewer";
  viewerUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(viewerUrl);
};

export const config = {
  matcher: ["/((?!_next).*)"],
};
