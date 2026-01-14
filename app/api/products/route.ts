import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Model, Variant } from "@prisma/client";
import { blockIfReadOnly } from "@/lib/access";

export const runtime = "nodejs";

const isModel = (value: string): value is Model =>
  value === Model.FL_640 ||
  value === Model.FL_540 ||
  value === Model.FL_470 ||
  value === Model.FL_400 ||
  value === Model.FL_340 ||
  value === Model.FL_260;

export async function GET() {
  await prisma.inventoryItem.createMany({
    data: [
      { model: Model.FL_640, serialNumber: 2901, variant: Variant.ZINC, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_640, serialNumber: 2901, variant: Variant.ORANGE, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_640, serialNumber: 2901, variant: Variant.ZINC, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_640, serialNumber: 2901, variant: Variant.ORANGE, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_540, serialNumber: 2716, variant: Variant.ZINC, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_540, serialNumber: 2716, variant: Variant.ORANGE, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_540, serialNumber: 2716, variant: Variant.ZINC, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_540, serialNumber: 2716, variant: Variant.ORANGE, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_470, serialNumber: 2404, variant: Variant.ZINC, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_470, serialNumber: 2404, variant: Variant.ORANGE, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_470, serialNumber: 2404, variant: Variant.ZINC, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_470, serialNumber: 2404, variant: Variant.ORANGE, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_400, serialNumber: 1801, variant: Variant.ZINC, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_400, serialNumber: 1801, variant: Variant.ORANGE, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_400, serialNumber: 1801, variant: Variant.ZINC, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_400, serialNumber: 1801, variant: Variant.ORANGE, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_340, serialNumber: 1403, variant: Variant.ZINC, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_340, serialNumber: 1403, variant: Variant.ORANGE, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_340, serialNumber: 1403, variant: Variant.ZINC, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_340, serialNumber: 1403, variant: Variant.ORANGE, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_260, serialNumber: 1203, variant: Variant.ZINC, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_260, serialNumber: 1203, variant: Variant.ORANGE, isSchwenkbock: false, quantity: 0, isManual: false },
      { model: Model.FL_260, serialNumber: 1203, variant: Variant.ZINC, isSchwenkbock: true, quantity: 0, isManual: false },
      { model: Model.FL_260, serialNumber: 1203, variant: Variant.ORANGE, isSchwenkbock: true, quantity: 0, isManual: false }
    ],
    skipDuplicates: true,
  });
  const items = await prisma.inventoryItem.findMany({
    select: { model: true, serialNumber: true, isManual: true },
    distinct: ["model", "serialNumber"],
    orderBy: [{ model: "asc" }, { serialNumber: "asc" }],
  });
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }

  const body = await request.json();
  const model = String(body.model || "");
  const serialNumber = Number(body.serialNumber);

  if (
    !isModel(model) ||
    !Number.isInteger(serialNumber) ||
    serialNumber <= 0
  ) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.inventoryItem.createMany({
        data: [
          {
            model,
            serialNumber,
            variant: Variant.ZINC,
            isSchwenkbock: false,
            quantity: 0,
            isManual: true,
          },
          {
            model,
            serialNumber,
            variant: Variant.ORANGE,
            isSchwenkbock: false,
            quantity: 0,
            isManual: true,
          },
          {
            model,
            serialNumber,
            variant: Variant.ZINC,
            isSchwenkbock: true,
            quantity: 0,
            isManual: true,
          },
          {
            model,
            serialNumber,
            variant: Variant.ORANGE,
            isSchwenkbock: true,
            quantity: 0,
            isManual: true,
          },
        ],
        skipDuplicates: true,
      });

      return { model, serialNumber };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }

  const body = await request.json();
  const model = String(body.model || "");
  const serialNumber = Number(body.serialNumber);

  if (!isModel(model) || !Number.isInteger(serialNumber) || serialNumber <= 0) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.inventoryItem.deleteMany({
      where: { model, serialNumber, isManual: true },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { message: "Cannot delete fixed item" },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
