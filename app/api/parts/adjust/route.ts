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
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
