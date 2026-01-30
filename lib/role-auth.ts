import { NextRequest, NextResponse } from "next/server";

export type AppRole = "VIEWER" | "EDITOR";

const ROLE_COOKIE = "pt_role";
const ROLE_AUTH_COOKIE = "pt_role_auth";

const rolePasswords: Record<AppRole, string | undefined> = {
  VIEWER: process.env.VIEWER_PASSWORD,
  EDITOR: process.env.EDITOR_PASSWORD,
};

const hashValue = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const isRole = (value: string): value is AppRole =>
  value === "VIEWER" || value === "EDITOR";

const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) {
    return false;
  }
  return left === right;
};

export const getRolePassword = (role: AppRole) => rolePasswords[role] ?? "";

export const verifyRoleSession = async (role: AppRole, cookieValue?: string) => {
  const password = getRolePassword(role);
  if (!password || !cookieValue) {
    return false;
  }
  const expected = await hashValue(password);
  return safeEqual(cookieValue, expected);
};

export const getRoleFromRequest = async (request: NextRequest) => {
  const roleValue = request.cookies.get(ROLE_COOKIE)?.value ?? "";
  const authValue = request.cookies.get(ROLE_AUTH_COOKIE)?.value ?? "";
  if (!isRole(roleValue)) {
    return null;
  }
  if (await verifyRoleSession(roleValue, authValue)) {
    return roleValue;
  }
  return null;
};

export const requireRole = async (
  request: NextRequest,
  allowedRoles: AppRole[]
) => {
  const role = await getRoleFromRequest(request);
  if (!role) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  return null;
};

export const setRoleCookies = async (response: NextResponse, role: AppRole) => {
  const password = getRolePassword(role);
  const secure = process.env.NODE_ENV === "production";
  const authValue = password ? await hashValue(password) : "";
  response.cookies.set(ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set(ROLE_AUTH_COOKIE, authValue, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
};

export const clearRoleCookies = (response: NextResponse) => {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ROLE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(ROLE_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
};

