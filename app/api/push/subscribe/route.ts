import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRoleFromRequest, requireRole } from "@/lib/role-auth";
import { getRoleUserId } from "@/lib/push";

export const runtime = "nodejs";

type SubscriptionBody = {
  subscription?: {
    endpoint: string;
    keys?: { p256dh?: string; auth?: string };
  };
  notificationTypes?: Record<string, boolean>;
  userAgent?: string;
  locale?: string;
};

export async function POST(request: NextRequest) {
  const blocked = await requireRole(request, ["VIEWER", "EDITOR"]);
  if (blocked) {
    return blocked;
  }
  const role = await getRoleFromRequest(request);
  if (!role) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as SubscriptionBody | null;
  const endpoint = body?.subscription?.endpoint ?? "";
  const p256dh = body?.subscription?.keys?.p256dh ?? "";
  const auth = body?.subscription?.keys?.auth ?? "";

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const userId = getRoleUserId(role);
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      userId,
      p256dh,
      auth,
      isActive: true,
      userAgent: body?.userAgent ? String(body.userAgent) : null,
    },
    create: {
      userId,
      endpoint,
      p256dh,
      auth,
      isActive: true,
      userAgent: body?.userAgent ? String(body.userAgent) : null,
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId },
    update: {
      notificationsOptIn: "ENABLED",
      notificationsAskAfter: null,
      notificationTypes: body?.notificationTypes ?? undefined,
      locale: body?.locale ? String(body.locale) : null,
    },
    create: {
      userId,
      notificationsOptIn: "ENABLED",
      notificationsAskAfter: null,
      notificationTypes: body?.notificationTypes ?? undefined,
      locale: body?.locale ? String(body.locale) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
