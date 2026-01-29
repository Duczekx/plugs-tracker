import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const categories = await prisma.part.findMany({
    where: {
      isArchived: false,
      category: {
        not: null,
        notIn: [""],
      },
    },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  const list = categories
    .map((entry) => entry.category?.trim())
    .filter((value): value is string => Boolean(value));

  return NextResponse.json({ categories: list });
}
