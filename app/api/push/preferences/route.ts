import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRoleFromRequest, requireRole } from "@/lib/role-auth";
import { getRoleUserId } from "@/lib/push";

export const runtime = "nodejs";

type PreferenceBody = {
  action?: "later" | "deny";
  askAfterDays?: number;
  locale?: string;
};

export async function GET(request: NextRequest) {
  const blocked = await requireRole(request, ["VIEWER", "EDITOR"]);
  if (blocked) {
    return blocked;
  }
  const role = await getRoleFromRequest(request);
  if (!role) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const userId = getRoleUserId(role);
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
  const blocked = await requireRole(request, ["VIEWER", "EDITOR"]);
  if (blocked) {
    return blocked;
  }
  const role = await getRoleFromRequest(request);
  if (!role) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as PreferenceBody | null;
  const userId = getRoleUserId(role);
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
