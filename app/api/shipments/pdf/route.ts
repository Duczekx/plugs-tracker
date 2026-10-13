import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/role-auth";
import { buildShipmentsPdf, type ReportMode } from "@/lib/shipments-pdf";
import type { Prisma, ShipmentStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["VIEWER", "EDITOR"]);
  if (auth) return auth;
  const params = request.nextUrl.searchParams;
  const mode = params.get("mode") ?? "all";
  if (!["all", "ready", "sent"].includes(mode)) {
    return NextResponse.json({ message: "Invalid report mode" }, { status: 400 });
  }
  const lang = params.get("lang") === "pl" ? "pl" : "de";
  const company = (params.get("company") ?? "").trim();
  const buildNumber = (params.get("buildNumber") ?? "").trim();
  const statuses: ShipmentStatus[] = mode === "ready" ? ["READY"] : mode === "sent" ? ["SENT"] : ["READY", "SENT"];
  const where: Prisma.ShipmentWhereInput = { status: { in: statuses } };
  // Match the full customer name exactly as the list does, including queries spanning name fields.
  if (buildNumber) where.items = { some: { buildNumber: { contains: buildNumber, mode: "insensitive" } } };
  try {
    const shipments = await prisma.shipment.findMany({ where,
      include: { items: { orderBy: { id: "asc" } }, extras: { orderBy: { id: "asc" } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const filtered = shipments.filter(s => (s.items.length > 0 || s.extras.length > 0) &&
      (!company || `${s.companyName} ${s.firstName} ${s.lastName}`.toLowerCase().includes(company.toLowerCase())));
    const pdf = await buildShipmentsPdf(filtered, { mode: mode as ReportMode, lang, company, buildNumber });
    return new NextResponse(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="shipments-${mode}.pdf"`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    console.error("Shipment PDF generation failed:", error);
    return NextResponse.json({ message: "PDF generation failed" }, { status: 500 });
  }
}
