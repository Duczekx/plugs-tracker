import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { blockIfReadOnly } from "@/lib/access";
import { sendShipmentEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(
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

  const body = await request.json().catch(() => ({}));
  const type = body?.type === "sent" ? "sent" : body?.type === "ready" ? "ready" : null;
  if (!type) {
    return NextResponse.json({ message: "Invalid type" }, { status: 400 });
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      items: { orderBy: { id: "asc" } },
      extras: { orderBy: { id: "asc" } },
    },
  });
  if (!shipment) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  try {
    await sendShipmentEmail(shipment, type);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("Email send failed", {
      shipmentId,
      type,
      message,
      stack: error instanceof Error ? error.stack : null,
    });
    return NextResponse.json({ message }, { status: 500 });
  }
}
