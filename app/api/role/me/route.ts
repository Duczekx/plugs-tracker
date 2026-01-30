import { NextRequest, NextResponse } from "next/server";
import { getRoleFromRequest } from "@/lib/role-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const role = await getRoleFromRequest(request);
  return NextResponse.json({ role });
}

