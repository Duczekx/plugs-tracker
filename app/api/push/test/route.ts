import { NextRequest, NextResponse } from "next/server";
import { getRoleFromRequest, requireRole } from "@/lib/role-auth";
import { buildPushPayload, getRoleLang, sendPushToRole } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const blocked = await requireRole(request, ["VIEWER", "EDITOR"]);
  if (blocked) {
    return blocked;
  }
  const role = await getRoleFromRequest(request);
  if (!role) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const lang = await getRoleLang(role);
  const payload = buildPushPayload("test", lang);
  await sendPushToRole(role, payload);
  return NextResponse.json({ ok: true });
}
