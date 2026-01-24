import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockIfReadOnly } from "@/lib/access";
import { blockIfNotAdmin } from "@/lib/admin-auth";
import type { BomConfiguration } from "@prisma/client";

export const runtime = "nodejs";

type BomItemInput = {
  partId: number;
  qtyPerPlow: number;
};

const allowedConfigurations = new Set<BomConfiguration>([
  "STANDARD",
  "STANDARD_6_2",
  "SCHWENKBOCK",
  "SCHWENKBOCK_6_2",
]);

export async function GET(request: NextRequest) {
  const adminBlocked = await blockIfNotAdmin(request);
  if (adminBlocked) {
    return adminBlocked;
  }

  const { searchParams } = new URL(request.url);
  const modelName = String(searchParams.get("modelName") ?? "").trim();
  const configurationRaw = String(searchParams.get("configuration") ?? "").trim();

  if (!modelName || !allowedConfigurations.has(configurationRaw as BomConfiguration)) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const configuration = configurationRaw as BomConfiguration;
  const bom = await prisma.bom.findUnique({
    where: { modelName_configuration: { modelName, configuration } },
    include: {
      items: {
        include: { part: true },
        orderBy: { id: "asc" },
      },
    },
  });

  return NextResponse.json({ bom });
}

export async function PUT(request: NextRequest) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }
  const adminBlocked = await blockIfNotAdmin(request);
  if (adminBlocked) {
    return adminBlocked;
  }

  const body = await request.json().catch(() => null);
  const modelName = String(body?.modelName ?? "").trim();
  const configurationRaw = String(body?.configuration ?? "").trim();
  const items = Array.isArray(body?.items) ? body.items : [];

  if (!modelName || !allowedConfigurations.has(configurationRaw as BomConfiguration)) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const configuration = configurationRaw as BomConfiguration;
  const normalizedItems: BomItemInput[] = items.map((item: BomItemInput) => ({
    partId: Number(item.partId),
    qtyPerPlow: Number(item.qtyPerPlow),
  }));

  if (
    normalizedItems.some(
      (item) =>
        !Number.isInteger(item.partId) ||
        item.partId <= 0 ||
        !Number.isInteger(item.qtyPerPlow) ||
        item.qtyPerPlow <= 0
    )
  ) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  try {
    const bom = await prisma.$transaction(async (tx) => {
      const record = await tx.bom.upsert({
        where: { modelName_configuration: { modelName, configuration } },
        update: {},
        create: { modelName, configuration },
      });

      await tx.bomItem.deleteMany({ where: { bomId: record.id } });
      if (normalizedItems.length > 0) {
        await tx.bomItem.createMany({
          data: normalizedItems.map((item) => ({
            bomId: record.id,
            partId: item.partId,
            qtyPerPlow: item.qtyPerPlow,
          })),
        });
      }

      return tx.bom.findUnique({
        where: { id: record.id },
        include: { items: { include: { part: true }, orderBy: { id: "asc" } } },
      });
    });

    return NextResponse.json({ bom });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
