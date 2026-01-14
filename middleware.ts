import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_COOKIE = "pt_auth";
const PUBLIC_FILE = /\.(.*)$/;

const hashValue = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const middleware = async (request: NextRequest) => {
  const { pathname, search } = request.nextUrl;

  const basicUser = process.env.BASIC_AUTH_USER;
  const basicPass = process.env.BASIC_AUTH_PASS;
  if (basicUser && basicPass) {
    const authHeader = request.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Basic ")) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": "Basic realm=\"Secure Area\"" },
      });
    }

    let isValid = false;
    try {
      const decoded = atob(authHeader.slice("Basic ".length));
      const separator = decoded.indexOf(":");
      if (separator !== -1) {
        const user = decoded.slice(0, separator);
        const pass = decoded.slice(separator + 1);
        isValid = user === basicUser && pass === basicPass;
      }
    } catch {
      isValid = false;
    }

    if (!isValid) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": "Basic realm=\"Secure Area\"" },
      });
    }
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
