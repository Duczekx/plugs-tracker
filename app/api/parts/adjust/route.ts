import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockIfReadOnly } from "@/lib/access";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }

  const body = await request.json().catch(() => null);
  const partId = Number(body?.partId);
  const delta = Number(body?.delta);
  const note = body?.note ? String(body.note).trim() : null;

  if (!Number.isInteger(partId) || !Number.isInteger(delta) || delta === 0) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.part.findUnique({
        where: { id: partId },
        select: { id: true, isArchived: true },
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }
      if (existing.isArchived) {
        throw new Error("ARCHIVED");
      }
      const updated = await tx.part.update({
        where: { id: partId },
        data: { stock: { increment: delta } },
      });
      await tx.partMovement.create({
        data: {
          partId,
          delta,
          reason: "MANUAL_ADJUST",
          note: note || null,
        },
      });
      return updated;
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "ARCHIVED") {
      return NextResponse.json({ message: "Part archived" }, { status: 409 });
    }
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
