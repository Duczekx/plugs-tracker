import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Model, Variant } from "@prisma/client";
import { blockIfReadOnly } from "@/lib/access";

export const runtime = "nodejs";

const isVariant = (value: string): value is Variant =>
  value === Variant.ZINC || value === Variant.ORANGE;

const isModel = (value: string): value is Model =>
  value === Model.FL_640 ||
  value === Model.FL_540 ||
  value === Model.FL_470 ||
  value === Model.FL_400 ||
  value === Model.FL_340 ||
  value === Model.FL_260;

export async function POST(request: NextRequest) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }

  const body = await request.json();
  const model = String(body.model || "");
  const serialNumber = Number(body.serialNumber);
  const variant = String(body.variant || "");
  const isSchwenkbock = Boolean(body.isSchwenkbock);
  const delta = Number(body.delta);

  if (
    !isModel(model) ||
    !Number.isInteger(serialNumber) ||
    serialNumber <= 0 ||
    !isVariant(variant) ||
    Number.isNaN(delta) ||
    delta === 0
  ) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.upsert({
        where: {
          model_serialNumber_variant_isSchwenkbock: {
            model,
            serialNumber,
            variant,
            isSchwenkbock,
          },
        },
        update: {},
        create: { model, serialNumber, variant, isSchwenkbock, quantity: 0 },
      });

      const nextQuantity = current.quantity + delta;
      if (nextQuantity < 0) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      const result = await tx.inventoryItem.update({
        where: {
          model_serialNumber_variant_isSchwenkbock: {
            model,
            serialNumber,
            variant,
            isSchwenkbock,
          },
        },
        data: { quantity: nextQuantity },
      });

      await tx.activityLog.create({
        data: {
          type: "inventory.adjust",
          entityType: "InventoryItem",
          entityId: `${model}-${serialNumber}-${variant}-${isSchwenkbock ? "S" : "N"}`,
          summary: `Adjust ${model} ${serialNumber} ${variant} ${
            isSchwenkbock ? "Schwenkbock" : "Standard"
          }: ${current.quantity} -> ${nextQuantity} (delta ${delta})`,
          meta: {
            model,
            serialNumber,
            variant,
            isSchwenkbock,
            delta,
            previousQuantity: current.quantity,
            nextQuantity,
          },
        },
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        { message: "Insufficient stock" },
        { status: 409 }
      );
    }
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
