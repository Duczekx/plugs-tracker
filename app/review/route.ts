import { NextRequest, NextResponse } from "next/server";

const READ_ONLY_COOKIE = "pt_mode";

export async function GET(request: NextRequest) {
  const reviewToken = process.env.REVIEW_TOKEN;
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", "/");

  if (reviewToken && token === reviewToken) {
    const response = NextResponse.redirect(loginUrl, 303);
    response.cookies.set(READ_ONLY_COOKIE, "review", {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  return NextResponse.redirect(loginUrl, 303);
}
