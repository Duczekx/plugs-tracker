import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/role-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const roleBlocked = await requireRole(request, ["VIEWER", "EDITOR"]);
  if (roleBlocked) {
    return roleBlocked;
  }
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
