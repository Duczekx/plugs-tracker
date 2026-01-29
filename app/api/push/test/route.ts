import { NextRequest, NextResponse } from "next/server";
import { blockIfNotAdmin, getAdminUser } from "@/lib/admin-auth";
import { buildPushPayload, getAdminLang, sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const adminBlocked = await blockIfNotAdmin(request);
  if (adminBlocked) {
    return adminBlocked;
  }
  const userId = getAdminUser();
  const lang = await getAdminLang();
  const payload = buildPushPayload("test", lang);
  await sendPushToUser(userId, payload);
  return NextResponse.json({ ok: true });
}
