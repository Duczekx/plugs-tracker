import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockIfNotApp, getAppUser } from "@/lib/app-auth";

export const runtime = "nodejs";

type UnsubscribeBody = {
  endpoint?: string;
  locale?: string;
};

export async function POST(request: NextRequest) {
  const appBlocked = await blockIfNotApp(request);
  if (appBlocked) {
    return appBlocked;
  }
  const body = (await request.json().catch(() => null)) as UnsubscribeBody | null;
  const userId = getAppUser();

  if (body?.endpoint) {
    await prisma.pushSubscription.updateMany({
      where: { endpoint: String(body.endpoint) },
      data: { isActive: false },
    });
  } else {
    await prisma.pushSubscription.updateMany({
      where: { userId },
      data: { isActive: false },
    });
  }

  await prisma.notificationPreference.upsert({
    where: { userId },
    update: {
      notificationsOptIn: "DENIED",
      notificationsAskAfter: null,
      locale: body?.locale ? String(body.locale) : null,
    },
    create: {
      userId,
      notificationsOptIn: "DENIED",
      notificationsAskAfter: null,
      locale: body?.locale ? String(body.locale) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
