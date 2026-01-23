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
    shopUrl?: string | null;
    shopName?: string | null;
  } = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (name.length < 2) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }
    updates.name = name;
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
    return NextResponse.json({ message: "Missing updates" }, { status: 400 });
  }

  try {
    const part = await prisma.part.update({
      where: { id: partId },
      data: updates,
    });
    return NextResponse.json(part);
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
