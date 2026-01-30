import { NextResponse } from "next/server";
import { clearRoleCookies } from "@/lib/role-auth";

export const runtime = "nodejs";

export async function GET() {
  const response = NextResponse.json({ ok: true });
  clearRoleCookies(response);
  return response;
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearRoleCookies(response);
  return response;
}

