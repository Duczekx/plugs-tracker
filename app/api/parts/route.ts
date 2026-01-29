import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockIfReadOnly } from "@/lib/access";
import { blockIfNotAdmin } from "@/lib/admin-auth";
import { Prisma } from "@prisma/client";
import { normalizeCategory } from "@/lib/parts-import";
import { expandSearchTerms, parseCategoryParam } from "@/lib/parts-search";

export const runtime = "nodejs";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get("q") ?? searchParams.get("search") ?? "").trim();
  const categoryParam = String(searchParams.get("category") ?? searchParams.get("cat") ?? "").trim();
  const categories = parseCategoryParam(categoryParam).filter((value) => value !== "all");
  const sort = String(searchParams.get("sort") ?? "name_asc").trim().toLowerCase();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const take = Math.min(200, Math.max(1, Number(searchParams.get("per") ?? PAGE_SIZE)));
  const skip = (page - 1) * take;

  const andFilters: Prisma.PartWhereInput[] = [{ isArchived: false }];
  if (categories.length) {
    andFilters.push({
      OR: categories.map((category) => ({
        category: { equals: category, mode: Prisma.QueryMode.insensitive },
      })),
    });
  }
  if (query) {
    const terms = expandSearchTerms(query);
    if (terms.length) {
      andFilters.push({
        OR: terms.flatMap((term) => [
          { name: { contains: term, mode: Prisma.QueryMode.insensitive } },
          { category: { contains: term, mode: Prisma.QueryMode.insensitive } },
        ]),
      });
    }
  }

  const where: Prisma.PartWhereInput = { AND: andFilters };

  const orderBy: Prisma.PartOrderByWithRelationInput[] =
    sort === "stock_asc"
      ? [{ stock: "asc" }, { name: "asc" }]
      : sort === "stock_desc"
        ? [{ stock: "desc" }, { name: "asc" }]
        : [{ name: "asc" }];

  const [items, totalCount] = await prisma.$transaction([
    prisma.part.findMany({
      where,
      orderBy,
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
  const unit = body?.unit ? String(body.unit).trim() : null;
  const category = body?.category ? String(body.category).trim() : null;
  const shopUrl = body?.shopUrl ? String(body.shopUrl).trim() : null;
  const shopName = body?.shopName ? String(body.shopName).trim() : null;

  if (name.length < 2 || !Number.isInteger(stock) || (unit && unit.length < 1)) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  try {
    const part = await prisma.part.create({
      data: {
        name,
        stock,
        unit: unit || "szt",
        category: category ? normalizeCategory(category) : null,
        shopUrl: shopUrl || null,
        shopName: shopName || null,
      },
    });
    return NextResponse.json(part, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
