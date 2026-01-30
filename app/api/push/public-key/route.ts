import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/role-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const blocked = await requireRole(request, ["VIEWER", "EDITOR"]);
  if (blocked) {
    return blocked;
  }
  const key = process.env.VAPID_PUBLIC_KEY ?? "";
  if (!key) {
    return NextResponse.json({ message: "Missing VAPID key" }, { status: 500 });
  }
  return NextResponse.json({ publicKey: key });
}
