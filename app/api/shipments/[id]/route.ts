import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BomConfiguration, Model, ShipmentStatus, ValveType, Variant } from "@prisma/client";
import { blockIfReadOnly } from "@/lib/access";
import {
  applyShipmentPartDeltas,
  buildPartsSummary,
  calculateShipmentDelta,
} from "@/lib/parts-ledger";

export const runtime = "nodejs";

const requiredFields = [
  "companyName",
  "firstName",
  "lastName",
  "street",
  "postalCode",
  "city",
  "country",
];

const isVariant = (value: string): value is Variant =>
  value === Variant.ZINC || value === Variant.ORANGE;

const isModel = (value: string): value is Model =>
  value === Model.FL_640 ||
  value === Model.FL_540 ||
  value === Model.FL_470 ||
  value === Model.FL_400 ||
  value === Model.FL_340 ||
  value === Model.FL_260;

const isValveType = (value: string): value is ValveType =>
  value === ValveType.NONE ||
  value === ValveType.SMALL ||
  value === ValveType.LARGE;

const isShipmentStatus = (value: string): value is ShipmentStatus =>
  value === ShipmentStatus.RESERVED ||
  value === ShipmentStatus.READY ||
  value === ShipmentStatus.SENT;

const deriveConfiguration = (item: Pick<IncomingItem, "isSchwenkbock" | "valveType">) => {
  const hasValve = item.valveType !== ValveType.NONE;
  if (item.isSchwenkbock && hasValve) {
    return BomConfiguration.SCHWENKBOCK_6_2;
  }
  if (item.isSchwenkbock) {
    return BomConfiguration.SCHWENKBOCK;
  }
  if (hasValve) {
    return BomConfiguration.STANDARD_6_2;
  }
  return BomConfiguration.STANDARD;
};

type IncomingItem = {
  model: string;
  serialNumber: number;
  variant: string;
  isSchwenkbock: boolean;
  quantity: number;
  buildNumber: string;
  buildDate: string;
  bucketHolder: boolean;
  valveType: string;
  extraParts?: string | null;
};

const inventoryKey = (
  item: Pick<
    IncomingItem,
    "model" | "serialNumber" | "variant" | "isSchwenkbock"
  >
) =>
  `${item.model}-${item.serialNumber}-${item.variant}-${
    item.isSchwenkbock ? "S" : "N"
  }`;

const normalizeItems = (items: IncomingItem[]) =>
  items.map((item) => {
    const model = String(item.model || "");
    const serialNumber = Number(item.serialNumber);
    const variant = String(item.variant || "");
    const quantity = Number(item.quantity);
    const buildNumber = String(item.buildNumber || "").trim();
    const buildDate = new Date(item.buildDate);
    const valveType = String(item.valveType || "");

    if (
      !isModel(model) ||
      !Number.isInteger(serialNumber) ||
      serialNumber <= 0 ||
      !isVariant(variant) ||
      Number.isNaN(quantity) ||
      quantity <= 0 ||
      !buildNumber ||
      Number.isNaN(buildDate.getTime()) ||
      !isValveType(valveType)
    ) {
      throw new Error("INVALID_ITEM");
    }

    return {
      model,
      serialNumber,
      variant,
      isSchwenkbock: Boolean(item.isSchwenkbock),
      configuration: deriveConfiguration({
        isSchwenkbock: Boolean(item.isSchwenkbock),
        valveType: valveType as ValveType,
      }),
      quantity,
      buildNumber,
      buildDate,
      bucketHolder: Boolean(item.bucketHolder),
      valveType,
      extraParts: item.extraParts ? String(item.extraParts) : null,
    };
  });

const hasDuplicateBuildNumbers = (items: { buildNumber: string }[]) => {
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.buildNumber.trim();
    if (!key) {
      continue;
    }
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  return false;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }

  const { id } = await params;
  const shipmentId = Number(id);
  if (!Number.isInteger(shipmentId)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const body = await request.json();
  const items = Array.isArray(body.items) ? (body.items as IncomingItem[]) : [];
  const statusValue = typeof body.status === "string" ? body.status : null;
  const status =
    statusValue && isShipmentStatus(statusValue)
      ? (statusValue as ShipmentStatus)
      : null;

  if (statusValue && !status) {
    return NextResponse.json({ message: "Invalid status" }, { status: 400 });
  }

  if (!items.length && status) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.shipment.findUnique({
          where: { id: shipmentId },
          include: { items: true, extras: true },
        });
        if (!existing) {
          throw new Error("NOT_FOUND");
        }
        const updated = await tx.shipment.update({
          where: { id: shipmentId },
          data: { status },
          include: { items: true, extras: true },
        });

        let stockWarnings = [];
        if (status === ShipmentStatus.READY) {
          const summary = await buildPartsSummary(tx, updated.items, updated.extras);
          const deltaByPartId = await calculateShipmentDelta(
            tx,
            updated.id,
            summary.requiredByPartId
          );
          stockWarnings = await applyShipmentPartDeltas(tx, updated.id, deltaByPartId);
        }

        if (status === ShipmentStatus.RESERVED) {
          const deltaByPartId = await calculateShipmentDelta(
            tx,
            updated.id,
            new Map()
          );
          stockWarnings = await applyShipmentPartDeltas(tx, updated.id, deltaByPartId);
        }

        await tx.activityLog.create({
          data: {
            type: "shipment.status",
            entityType: "Shipment",
            entityId: String(updated.id),
            summary: `Shipment ${updated.id} status ${existing.status} -> ${status}`,
            meta: {
              shipmentId: updated.id,
              fromStatus: existing.status,
              toStatus: status,
            },
          },
        });
        return { updated, stockWarnings };
      });
      return NextResponse.json({
        ...result.updated,
        stockWarnings: result.stockWarnings,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message === "NOT_FOUND"
          ? "Not found"
          : "Server error";
      const statusCode = message === "Not found" ? 404 : 500;
      return NextResponse.json({ message }, { status: statusCode });
    }
  }

  if (!items.length) {
    return NextResponse.json({ message: "Missing items" }, { status: 400 });
  }

  for (const field of requiredFields) {
    if (!body[field] || String(body[field]).trim().length === 0) {
      return NextResponse.json(
        { message: `Missing field: ${field}` },
        { status: 400 }
      );
    }
  }

  let validatedItems: ReturnType<typeof normalizeItems> = [];
  try {
    validatedItems = normalizeItems(items);
    if (hasDuplicateBuildNumbers(validatedItems)) {
      return NextResponse.json({ message: "Duplicate build number" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const totals = new Map<string, number>();
  validatedItems.forEach((item) => {
    const key = inventoryKey(item);
    totals.set(key, (totals.get(key) ?? 0) + item.quantity);
  });

  try {
    const shipment = await prisma.$transaction(async (tx) => {
      const existing = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: { items: true, extras: true },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const restoreTotals = new Map<string, number>();
      existing.items.forEach((item) => {
        const key = inventoryKey({
          model: item.model,
          serialNumber: item.serialNumber,
          variant: item.variant,
          isSchwenkbock: item.isSchwenkbock,
        });
        restoreTotals.set(key, (restoreTotals.get(key) ?? 0) + item.quantity);
      });

      for (const [key, qty] of restoreTotals.entries()) {
        const [model, serial, variant, schwenkFlag] = key.split("-");
        const serialNumber = Number(serial);
        const isSchwenkbock = schwenkFlag === "S";
        await tx.inventoryItem.upsert({
          where: {
            model_serialNumber_variant_isSchwenkbock: {
              model: model as Model,
              serialNumber,
              variant: variant as Variant,
              isSchwenkbock,
            },
          },
          update: { quantity: { increment: qty } },
          create: {
            model: model as Model,
            serialNumber,
            variant: variant as Variant,
            isSchwenkbock,
            quantity: qty,
          },
        });
      }

      for (const [key, totalQty] of totals.entries()) {
        const [model, serial, variant, schwenkFlag] = key.split("-");
        const serialNumber = Number(serial);
        const isSchwenkbock = schwenkFlag === "S";
        const inventory = await tx.inventoryItem.upsert({
          where: {
            model_serialNumber_variant_isSchwenkbock: {
              model: model as Model,
              serialNumber,
              variant: variant as Variant,
              isSchwenkbock,
            },
          },
          update: {},
          create: {
            model: model as Model,
            serialNumber,
            variant: variant as Variant,
            isSchwenkbock,
            quantity: 0,
          },
        });

        if (inventory.quantity < totalQty) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        await tx.inventoryItem.update({
          where: {
            model_serialNumber_variant_isSchwenkbock: {
              model: model as Model,
              serialNumber,
              variant: variant as Variant,
              isSchwenkbock,
            },
          },
          data: { quantity: inventory.quantity - totalQty },
        });
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          companyName: String(body.companyName),
          firstName: String(body.firstName),
          lastName: String(body.lastName),
          street: String(body.street),
          postalCode: String(body.postalCode),
          city: String(body.city),
          country: String(body.country),
          notes: body.notes ? String(body.notes) : null,
          ...(status ? { status } : {}),
          items: {
            deleteMany: {},
            create: validatedItems.map((item) => ({
              model: item.model as Model,
              serialNumber: item.serialNumber,
              variant: item.variant as Variant,
              isSchwenkbock: item.isSchwenkbock,
              configuration: item.configuration,
              quantity: item.quantity,
              buildNumber: item.buildNumber,
              buildDate: item.buildDate,
              bucketHolder: item.bucketHolder,
              valveType: item.valveType as ValveType,
              extraParts: item.extraParts,
            })),
          },
        },
        include: { items: true, extras: true },
      });

      const nextStatus = status ?? existing.status;
      let stockWarnings = [];
      if (nextStatus === ShipmentStatus.READY) {
        const summary = await buildPartsSummary(tx, updated.items, updated.extras);
        const deltaByPartId = await calculateShipmentDelta(
          tx,
          updated.id,
          summary.requiredByPartId
        );
        stockWarnings = await applyShipmentPartDeltas(tx, updated.id, deltaByPartId);
      }

      if (nextStatus === ShipmentStatus.RESERVED) {
        const deltaByPartId = await calculateShipmentDelta(
          tx,
          updated.id,
          new Map()
        );
        stockWarnings = await applyShipmentPartDeltas(tx, updated.id, deltaByPartId);
      }

      if (status && existing.status !== status) {
        await tx.activityLog.create({
          data: {
            type: "shipment.status",
            entityType: "Shipment",
            entityId: String(updated.id),
            summary: `Shipment ${updated.id} status ${existing.status} -> ${status}`,
            meta: {
              shipmentId: updated.id,
              fromStatus: existing.status,
              toStatus: status,
            },
          },
        });
      }

      return { updated, stockWarnings };
    });

    return NextResponse.json({
      ...shipment.updated,
      stockWarnings: shipment.stockWarnings,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "NOT_FOUND"
        ? "Not found"
        : error instanceof Error && error.message === "INSUFFICIENT_STOCK"
        ? "Insufficient stock"
        : "Server error";
    const status =
      message === "Not found" ? 404 : message === "Insufficient stock" ? 409 : 500;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }

  const { id } = await params;
  const shipmentId = Number(id);
  if (!Number.isInteger(shipmentId)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: { items: true, extras: true },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const restoreTotals = new Map<string, number>();
      existing.items.forEach((item) => {
        const key = inventoryKey({
          model: item.model,
          serialNumber: item.serialNumber,
          variant: item.variant,
          isSchwenkbock: item.isSchwenkbock,
        });
        restoreTotals.set(key, (restoreTotals.get(key) ?? 0) + item.quantity);
      });

      for (const [key, qty] of restoreTotals.entries()) {
        const [model, serial, variant, schwenkFlag] = key.split("-");
        const serialNumber = Number(serial);
        const isSchwenkbock = schwenkFlag === "S";
        await tx.inventoryItem.upsert({
          where: {
            model_serialNumber_variant_isSchwenkbock: {
              model: model as Model,
              serialNumber,
              variant: variant as Variant,
              isSchwenkbock,
            },
          },
          update: { quantity: { increment: qty } },
          create: {
            model: model as Model,
            serialNumber,
            variant: variant as Variant,
            isSchwenkbock,
            quantity: qty,
          },
        });
      }

      await tx.shipment.delete({ where: { id: shipmentId } });

      await tx.activityLog.create({
        data: {
          type: "shipment.delete",
          entityType: "Shipment",
          entityId: String(existing.id),
          summary: `Shipment ${existing.id} deleted (${existing.companyName})`,
          meta: {
            shipmentId: existing.id,
            companyName: existing.companyName,
            itemsCount: existing.items.length,
            extrasCount: existing.extras.length,
          },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "NOT_FOUND"
        ? "Not found"
        : "Server error";
    const status = message === "Not found" ? 404 : 500;
    return NextResponse.json({ message }, { status });
  }
}
