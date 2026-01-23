import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockIfNotAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const adminBlocked = await blockIfNotAdmin(request);
  if (adminBlocked) {
    return adminBlocked;
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const take = Math.min(200, Math.max(1, Number(searchParams.get("per") ?? PAGE_SIZE)));
  const skip = (page - 1) * take;
  const reason = searchParams.get("reason");
  const shipmentId = searchParams.get("shipmentId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (reason) {
    where.reason = reason;
  }
  if (shipmentId && Number.isInteger(Number(shipmentId))) {
    where.shipmentId = Number(shipmentId);
  }
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) {
      createdAt.gte = new Date(from);
    }
    if (to) {
      createdAt.lte = new Date(to);
    }
    where.createdAt = createdAt;
  }

  const [items, totalCount] = await prisma.$transaction([
    prisma.partMovement.findMany({
      where,
      include: { part: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.partMovement.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / take));
  return NextResponse.json({
    items,
    page,
    totalPages,
    totalCount,
  });
}
