import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const APP_COOKIE = "pt_auth";
const APP_USER = "App";

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

export const getAppCookieName = () => APP_COOKIE;

export const getAppUser = () => APP_USER;

export const getAppPassword = () => process.env.APP_PASSWORD ?? "";

export const buildAppCookieValue = async () => {
  const password = getAppPassword();
  if (!password) {
    return "";
  }
  return hashValue(password);
};

export const verifyAppSession = async (cookieValue?: string) => {
  const password = getAppPassword();
  if (!password || !cookieValue) {
    return false;
  }
  const expected = await hashValue(password);
  return safeEqual(cookieValue, expected);
};

export const blockIfNotApp = async (request: NextRequest) => {
  const cookieValue = request.cookies.get(APP_COOKIE)?.value;
  if (await verifyAppSession(cookieValue)) {
    return null;
  }
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
};
