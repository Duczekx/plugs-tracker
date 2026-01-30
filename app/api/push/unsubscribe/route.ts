import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRoleFromRequest, requireRole } from "@/lib/role-auth";
import { getRoleUserId } from "@/lib/push";

export const runtime = "nodejs";

type UnsubscribeBody = {
  endpoint?: string;
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
  const body = (await request.json().catch(() => null)) as UnsubscribeBody | null;
  const userId = getRoleUserId(role);

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
