import { NextResponse } from "next/server";

const AUTH_COOKIE = "pt_auth";

const hashValue = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  const appPassword = process.env.APP_PASSWORD;

  if (!appPassword) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "missing");
    return NextResponse.redirect(url, 303);
  }

  if (password !== appPassword) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "invalid");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(AUTH_COOKIE, await hashValue(appPassword), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
