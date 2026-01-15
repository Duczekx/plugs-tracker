import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { blockIfNotAdmin } from "@/lib/access";

export const runtime = "nodejs";

const toNumber = (value: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function GET(request: NextRequest) {
  const blocked = blockIfNotAdmin(request);
  if (blocked) {
    return blocked;
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(Math.max(toNumber(searchParams.get("take")) ?? 50, 1), 100);
  const cursor = toNumber(searchParams.get("cursor"));
  const query = (searchParams.get("q") ?? "").trim();

  const where =
    query.length > 0
      ? {
          OR: [
            { summary: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { type: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { entityType: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { entityId: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : undefined;

  const logs = await prisma.activityLog.findMany({
    take: take + 1,
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
  });

  let nextCursor: number | null = null;
  if (logs.length > take) {
    const next = logs.pop();
    nextCursor = next ? next.id : null;
  }

  return NextResponse.json({
    items: logs,
    nextCursor,
  });
}
