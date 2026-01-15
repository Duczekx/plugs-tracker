import { NextRequest, NextResponse } from "next/server";

const READ_ONLY_COOKIE = "pt_mode";
const ADMIN_HEADER = "x-admin-key";
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";

export const isReadOnly = (request: NextRequest) =>
  request.cookies.get(READ_ONLY_COOKIE)?.value === "review";

export const blockIfReadOnly = (request: NextRequest) => {
  if (!isReadOnly(request)) {
    return null;
  }

  return NextResponse.json({ message: "Read-only access" }, { status: 403 });
};

export const hasAdminKey = (request: NextRequest) => {
  if (!ADMIN_KEY) {
    return false;
  }
  const key = request.headers.get(ADMIN_HEADER) ?? "";
  return key === ADMIN_KEY;
};

export const blockIfNotAdmin = (request: NextRequest) => {
  if (hasAdminKey(request)) {
    return null;
  }
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
};
