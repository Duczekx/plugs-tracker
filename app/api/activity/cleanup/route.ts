import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockIfNotAdmin } from "@/lib/access";

export const runtime = "nodejs";

const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const blocked = blockIfNotAdmin(request);
  if (blocked) {
    return blocked;
  }

  const cutoff = new Date(Date.now() - daysToMs(180));
  const result = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return NextResponse.json({ deleted: result.count });
}
