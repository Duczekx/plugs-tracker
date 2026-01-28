import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockIfReadOnly } from "@/lib/access";
import { blockIfNotAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }
  const adminBlocked = await blockIfNotAdmin(request);
  if (adminBlocked) {
    return adminBlocked;
  }

  const { id } = await params;
  const partId = Number(id);
  if (!Number.isInteger(partId)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const updates: {
    name?: string;
    unit?: string;
    shopUrl?: string | null;
    shopName?: string | null;
  } = {};
  const stockAbsolute =
    body?.stockAbsolute !== undefined ? Number(body.stockAbsolute) : undefined;

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (name.length < 2) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }
    updates.name = name;
  }

  if (typeof body?.unit === "string") {
    const unit = body.unit.trim();
    if (!unit) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }
    updates.unit = unit;
  }

  if (body?.shopUrl !== undefined) {
    const value = String(body.shopUrl ?? "").trim();
    updates.shopUrl = value ? value : null;
  }

  if (body?.shopName !== undefined) {
    const value = String(body.shopName ?? "").trim();
    updates.shopName = value ? value : null;
  }

  if (Object.keys(updates).length === 0) {
    if (stockAbsolute === undefined || Number.isNaN(stockAbsolute)) {
      return NextResponse.json({ message: "Missing updates" }, { status: 400 });
    }
  }

  try {
    const part = await prisma.$transaction(async (tx) => {
      const existing = await tx.part.findUnique({
        where: { id: partId },
        select: { id: true, stock: true, isArchived: true },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }
      if (existing.isArchived) {
        throw new Error("ARCHIVED");
      }
      if (stockAbsolute !== undefined && Number.isNaN(stockAbsolute)) {
        throw new Error("INVALID_STOCK");
      }
      if (stockAbsolute !== undefined) {
        const nextStock = Math.trunc(stockAbsolute);
        if (!Number.isInteger(nextStock)) {
          throw new Error("INVALID_STOCK");
        }
        const delta = nextStock - existing.stock;
        if (delta !== 0) {
          await tx.part.update({
            where: { id: partId },
            data: { stock: nextStock },
          });
          await tx.partMovement.create({
            data: {
              partId,
              delta,
              reason: "MANUAL_ADJUST",
              note: `Ustawiono stan na ${nextStock}`,
            },
          });
        }
      }
      if (Object.keys(updates).length > 0) {
        await tx.part.update({
          where: { id: partId },
          data: updates,
        });
      }
      return tx.part.findUnique({ where: { id: partId } });
    });
    return NextResponse.json(part);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "ARCHIVED") {
      return NextResponse.json({ message: "Part archived" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "INVALID_STOCK") {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }
    return NextResponse.json({ message: "Server error" }, { status: 500 });
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
  const adminBlocked = await blockIfNotAdmin(request);
  if (adminBlocked) {
    return adminBlocked;
  }

  const { id } = await params;
  const partId = Number(id);
  if (!Number.isInteger(partId)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  try {
    const [bomUsage, movementUsage] = await prisma.$transaction([
      prisma.bomItem.count({ where: { partId } }),
      prisma.partMovement.count({ where: { partId } }),
    ]);
    if (bomUsage > 0 || movementUsage > 0) {
      return NextResponse.json({ message: "PART_IN_USE" }, { status: 409 });
    }

    const part = await prisma.part.update({
      where: { id: partId },
      data: { isArchived: true },
    });
    return NextResponse.json(part);
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
