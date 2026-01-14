import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "pt_auth";
const READ_ONLY_COOKIE = "pt_mode";
const PUBLIC_FILE = /\.(.*)$/;

const hashValue = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const proxy = async (request: NextRequest) => {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/review") {
    const reviewToken = process.env.REVIEW_TOKEN;
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", "/");

    if (reviewToken && token === reviewToken) {
      const response = NextResponse.redirect(loginUrl);
      response.cookies.set(READ_ONLY_COOKIE, "review", {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    return NextResponse.redirect(loginUrl);
  }

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/login" ||
    pathname.startsWith("/api/login") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return NextResponse.next();
  }

  const expected = await hashValue(appPassword);
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
};

export const config = {
  matcher: ["/((?!_next).*)"],
};
