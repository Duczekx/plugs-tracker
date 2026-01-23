import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const ADMIN_COOKIE = "pt_admin";
const ADMIN_USER = "Admin";

const hashValue = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const safeEqual = (left: string, right: string) => {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
};

export const getAdminCookieName = () => ADMIN_COOKIE;

export const getAdminUser = () => ADMIN_USER;

export const getAdminPassword = () => process.env.ADMIN_PASSWORD ?? "";

export const buildAdminCookieValue = async () => {
  const password = getAdminPassword();
  if (!password) {
    return "";
  }
  return hashValue(password);
};

export const verifyAdminSession = async (cookieValue?: string) => {
  const password = getAdminPassword();
  if (!password || !cookieValue) {
    return false;
  }
  const expected = await hashValue(password);
  return safeEqual(cookieValue, expected);
};

export const blockIfNotAdmin = async (request: NextRequest) => {
  const cookieValue = request.cookies.get(ADMIN_COOKIE)?.value;
  if (await verifyAdminSession(cookieValue)) {
    return null;
  }
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
};
