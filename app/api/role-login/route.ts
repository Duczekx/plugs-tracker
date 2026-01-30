import { NextResponse } from "next/server";
import {
  type AppRole,
  getRolePassword,
  setRoleCookies,
} from "@/lib/role-auth";

export const runtime = "nodejs";

const isRole = (value: string): value is AppRole =>
  value === "VIEWER" || value === "EDITOR";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let roleValue = "";
  let password = "";
  let next = "/";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    roleValue = String(body?.role ?? "");
    password = String(body?.password ?? "");
    next = body?.next ? String(body.next) : "/";
  } else {
    const formData = await request.formData();
    roleValue = String(formData.get("role") ?? "");
    password = String(formData.get("password") ?? "");
    next = String(formData.get("next") ?? "/");
  }

  if (!isRole(roleValue)) {
    const url = new URL("/viewer", request.url);
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url, 303);
  }

  const expectedPassword = getRolePassword(roleValue);
  if (!expectedPassword) {
    const url = new URL(roleValue === "VIEWER" ? "/viewer" : "/editor", request.url);
    url.searchParams.set("error", "missing");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  if (password !== expectedPassword) {
    const url = new URL(roleValue === "VIEWER" ? "/viewer" : "/editor", request.url);
    url.searchParams.set("error", "invalid");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  await setRoleCookies(response, roleValue);
  if (roleValue === "EDITOR") {
    response.cookies.set("pt_mode", "", {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}
