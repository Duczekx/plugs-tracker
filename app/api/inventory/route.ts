import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const items = await prisma.inventoryItem.findMany({
    orderBy: [{ model: "asc" }, { serialNumber: "asc" }, { variant: "asc" }],
  });
  return NextResponse.json(items);
}
