import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockIfNotApp, getAppUser } from "@/lib/app-auth";

export const runtime = "nodejs";

type PreferenceBody = {
  action?: "later" | "deny";
  askAfterDays?: number;
  locale?: string;
};

export async function GET(request: NextRequest) {
  const appBlocked = await blockIfNotApp(request);
  if (appBlocked) {
    return appBlocked;
  }
  const userId = getAppUser();
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  return NextResponse.json({
    optIn: pref?.notificationsOptIn ?? "DEFAULT",
    askAfter: pref?.notificationsAskAfter ?? null,
    notificationTypes: pref?.notificationTypes ?? null,
    locale: pref?.locale ?? null,
  });
}

export async function POST(request: NextRequest) {
  const appBlocked = await blockIfNotApp(request);
  if (appBlocked) {
    return appBlocked;
  }
  const body = (await request.json().catch(() => null)) as PreferenceBody | null;
  const userId = getAppUser();
  const now = new Date();
  const action = body?.action;

  if (action === "later") {
    const days = Number(body?.askAfterDays ?? 7);
    const askAfter = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    await prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        notificationsOptIn: "LATER",
        notificationsAskAfter: askAfter,
        locale: body?.locale ? String(body.locale) : null,
      },
      create: {
        userId,
        notificationsOptIn: "LATER",
        notificationsAskAfter: askAfter,
        locale: body?.locale ? String(body.locale) : null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "deny") {
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
    await prisma.pushSubscription.updateMany({
      where: { userId },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
}
