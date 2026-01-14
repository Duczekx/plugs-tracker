import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Model, ValveType, Variant } from "@prisma/client";
import { blockIfReadOnly } from "@/lib/access";

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

export async function GET() {
  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { id: "asc" } } },
  });
  return NextResponse.json(shipments);
}

export async function POST(request: NextRequest) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }

  const body = await request.json();
  const items = Array.isArray(body.items) ? (body.items as IncomingItem[]) : [];

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

  let validatedItems: {
    model: string;
    serialNumber: number;
    variant: string;
    isSchwenkbock: boolean;
    quantity: number;
    buildNumber: string;
    buildDate: Date;
    bucketHolder: boolean;
    valveType: string;
    extraParts: string | null;
  }[] = [];

  try {
    validatedItems = items.map((item) => {
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
        quantity,
        buildNumber,
        buildDate,
        bucketHolder: Boolean(item.bucketHolder),
        valveType,
        extraParts: item.extraParts ? String(item.extraParts) : null,
      };
    });
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

      return tx.shipment.create({
        data: {
          companyName: String(body.companyName),
          firstName: String(body.firstName),
          lastName: String(body.lastName),
          street: String(body.street),
          postalCode: String(body.postalCode),
          city: String(body.city),
          country: String(body.country),
          notes: body.notes ? String(body.notes) : null,
          items: {
            create: validatedItems.map((item) => ({
              model: item.model as Model,
              serialNumber: item.serialNumber,
              variant: item.variant as Variant,
              isSchwenkbock: item.isSchwenkbock,
              quantity: item.quantity,
              buildNumber: item.buildNumber,
              buildDate: item.buildDate,
              bucketHolder: item.bucketHolder,
              valveType: item.valveType as ValveType,
              extraParts: item.extraParts,
            })),
          },
        },
        include: { items: true },
      });
    });

    return NextResponse.json(shipment, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "INSUFFICIENT_STOCK"
        ? "Insufficient stock"
        : error instanceof Error && error.message === "INVALID_ITEM"
        ? "Invalid payload"
        : "Server error";
    const status =
      message === "Insufficient stock" ? 409 : message === "Invalid payload" ? 400 : 500;
    return NextResponse.json({ message }, { status });
  }
}
