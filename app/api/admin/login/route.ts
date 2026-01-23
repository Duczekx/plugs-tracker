import { NextResponse } from "next/server";
import {
  buildAdminCookieValue,
  getAdminUser,
  getAdminPassword,
  getAdminCookieName,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = String(body?.username ?? "");
  const password = String(body?.password ?? "");
  const expectedUser = getAdminUser();
  const expectedPassword = getAdminPassword();

  if (!expectedPassword) {
    return NextResponse.json({ message: "Missing password" }, { status: 500 });
  }

  if (username !== expectedUser || password !== expectedPassword) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
  }

  const cookieValue = await buildAdminCookieValue();
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(getAdminCookieName(), cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return response;
}
