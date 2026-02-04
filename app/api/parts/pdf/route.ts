import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/role-auth";

export const runtime = "nodejs";

type PdfPart = {
  name: string;
  category: string | null;
  stock: number;
  unit: string;
  warningThreshold: number | null;
};

const formatTimestamp = (date: Date) =>
  date.toLocaleString("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const resolveLowStock = (part: PdfPart) =>
  part.stock <= (part.warningThreshold ?? 2);

const normalizeCategory = (category: string | null) => {
  const trimmed = category?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Inne";
};

const buildPdf = async (mode: "all" | "low", items: PdfPart[]) => {
  const pdfkit = await import("pdfkit");
  const PDFDocument = (pdfkit as any).default ?? (pdfkit as any);
  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk as Buffer));

  const title = "Flächenschneeschieber";
  const subtitle = "Lista części";
  const timestamp = formatTimestamp(new Date());
  const showThreshold = items.some((item) => item.warningThreshold !== null);

  const columnWidths = showThreshold
    ? [240, 120, 60, 60, 60]
    : [260, 140, 60, 70];
  const columnLabels = showThreshold
    ? ["Nazwa", "Kategoria", "Stan", "Jednostka", "Prog"]
    : ["Nazwa", "Kategoria", "Stan", "Jednostka"];

  const rowHeight = 18;
  const tableTopPadding = 12;

  const drawHeader = (pageTitle: string) => {
    doc.fontSize(18).fillColor("#111").text(title);
    doc.fontSize(14).text(pageTitle);
    doc
      .fontSize(9)
      .fillColor("#666")
      .text(`Data: ${timestamp}`, { align: "left" });
    doc
      .fontSize(10)
      .fillColor("#111")
      .text(`Pozycji: ${items.length}`, { align: "left" });
    doc.moveDown();
  };

  const drawTableHeader = () => {
    const startX = doc.page.margins.left;
    let x = startX;
    doc.fontSize(10).fillColor("#444");
    columnLabels.forEach((label, index) => {
      doc.text(label, x, doc.y, { width: columnWidths[index], continued: false });
      x += columnWidths[index];
    });
    doc
      .moveTo(startX, doc.y + 2)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
      .strokeColor("#ddd")
      .stroke();
    doc.moveDown(0.6);
  };

  const drawRow = (part: PdfPart) => {
    const startX = doc.page.margins.left;
    let x = startX;
    const values = showThreshold
      ? [
          part.name,
          part.category ?? "-",
          String(part.stock),
          part.unit,
          part.warningThreshold !== null ? String(part.warningThreshold) : "-",
        ]
      : [part.name, part.category ?? "-", String(part.stock), part.unit];
    values.forEach((value, index) => {
      doc.text(value, x, doc.y, {
        width: columnWidths[index],
        height: rowHeight,
        ellipsis: true,
      });
      x += columnWidths[index];
    });
    doc.moveDown();
  };

  const categoryMap = new Map<string, PdfPart[]>();
  items.forEach((part) => {
    const category = normalizeCategory(part.category);
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)?.push(part);
  });

  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) =>
    a.localeCompare(b, "pl")
  );

  drawHeader(mode === "low" ? "Lista części - niski stan" : subtitle);

  sortedCategories.forEach((category) => {
    const categoryItems = categoryMap.get(category) ?? [];
    if (categoryItems.length === 0) {
      return;
    }

    const sectionHeaderLimit = doc.page.height - doc.page.margins.bottom - rowHeight * 3;
    if (doc.y > sectionHeaderLimit) {
      doc.addPage();
      drawHeader(mode === "low" ? "Lista części - niski stan" : subtitle);
    }

    doc
      .fontSize(11)
      .fillColor("#222")
      .text(`${category} (${categoryItems.length})`);
    doc.moveDown(0.4);
    drawTableHeader();

    categoryItems.forEach((part) => {
      const bottomLimit = doc.page.height - doc.page.margins.bottom - rowHeight * 2;
      if (doc.y > bottomLimit) {
        doc.addPage();
        drawHeader(mode === "low" ? "Lista części - niski stan" : subtitle);
        doc
          .fontSize(11)
          .fillColor("#222")
          .text(`${category} (${categoryItems.length})`);
        doc.moveDown(0.4);
        drawTableHeader();
      }
      drawRow(part);
    });

    doc.moveDown(0.6);
  });

  const pageRange = doc.bufferedPageRange();
  for (let index = 0; index < pageRange.count; index += 1) {
    doc.switchToPage(index);
    doc.fontSize(9).fillColor("#666");
    doc.text(
      `Strona ${index + 1} / ${pageRange.count}`,
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom + 10,
      {
        align: "center",
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      }
    );
  }

  doc.end();

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  return buffer;
};

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["VIEWER", "EDITOR"]);
  if (auth) {
    return auth;
  }

  const modeParam = request.nextUrl.searchParams.get("mode");
  const mode = modeParam === "low" ? "low" : "all";

  const parts = await prisma.part.findMany({
    where: { isArchived: false },
    select: {
      name: true,
      category: true,
      stock: true,
      unit: true,
      warningThreshold: true,
    },
    orderBy: { name: "asc" },
  });

  const filtered =
    mode === "low" ? parts.filter((part) => resolveLowStock(part)) : parts;

  const pdfBuffer = await buildPdf(mode, filtered);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename=\"parts-${mode}.pdf\"`,
      "Cache-Control": "no-store",
    },
  });
}
