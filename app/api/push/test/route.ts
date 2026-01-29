import { NextRequest, NextResponse } from "next/server";
import { blockIfNotApp, getAppUser } from "@/lib/app-auth";
import { buildPushPayload, getAppLang, sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const appBlocked = await blockIfNotApp(request);
  if (appBlocked) {
    return appBlocked;
  }
  const userId = getAppUser();
  const lang = await getAppLang();
  const payload = buildPushPayload("test", lang);
  await sendPushToUser(userId, payload);
  return NextResponse.json({ ok: true });
}
