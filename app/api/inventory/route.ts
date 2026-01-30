import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/role-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const roleBlocked = await requireRole(request, ["VIEWER", "EDITOR"]);
  if (roleBlocked) {
    return roleBlocked;
  }
  const items = await prisma.inventoryItem.findMany({
    orderBy: [{ model: "asc" }, { serialNumber: "asc" }, { variant: "asc" }],
  });
  return NextResponse.json(items);
}
