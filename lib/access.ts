import { NextRequest, NextResponse } from "next/server";

const READ_ONLY_COOKIE = "pt_mode";

export const isReadOnly = (request: NextRequest) =>
  request.cookies.get(READ_ONLY_COOKIE)?.value === "review";

export const blockIfReadOnly = (request: NextRequest) => {
  if (!isReadOnly(request)) {
    return null;
  }

  return NextResponse.json({ message: "Read-only access" }, { status: 403 });
};
