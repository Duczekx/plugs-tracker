import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockIfReadOnly } from "@/lib/access";
import { blockIfNotAdmin } from "@/lib/admin-auth";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const take = Math.min(200, Math.max(1, Number(searchParams.get("per") ?? PAGE_SIZE)));
  const skip = (page - 1) * take;

  const where: Prisma.PartWhereInput | undefined = query
    ? {
        name: {
          contains: query,
          mode: Prisma.QueryMode.insensitive,
        },
      }
    : undefined;

  const [items, totalCount] = await prisma.$transaction([
    prisma.part.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    prisma.part.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / take));
  return NextResponse.json({
    items,
    page,
    totalPages,
    totalCount,
  });
}

export async function POST(request: NextRequest) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }
  const adminBlocked = await blockIfNotAdmin(request);
  if (adminBlocked) {
    return adminBlocked;
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const stock = Number(body?.stock ?? 0);
  const shopUrl = body?.shopUrl ? String(body.shopUrl).trim() : null;
  const shopName = body?.shopName ? String(body.shopName).trim() : null;

  if (name.length < 2 || !Number.isInteger(stock)) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  try {
    const part = await prisma.part.create({
      data: {
        name,
        stock,
        shopUrl: shopUrl || null,
        shopName: shopName || null,
      },
    });
    return NextResponse.json(part, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
