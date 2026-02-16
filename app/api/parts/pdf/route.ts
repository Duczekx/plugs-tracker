import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/role-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PdfPart = {
  name: string;
  category: string | null;
  stock: number;
  unit: string;
  warningThreshold: number | null;
};

const formatTimestamp = (date: Date) =>
  date.toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const resolveLowStock = (part: PdfPart) => part.stock <= (part.warningThreshold ?? 2);

const normalizeCategory = (category: string | null) => {
  const trimmed = category?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Sonstiges";
};

const buildPdf = async (mode: "all" | "low", items: PdfPart[]) => {
  const pdfkitModule = await import("pdfkit");
  const PDFDocument = (pdfkitModule.default ?? pdfkitModule) as typeof pdfkitModule.default;

  const fontCandidates = [
    path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf"),
    path.join(process.cwd(), "public", "fonts", "noto-sans-regular.ttf"),
  ];
  const boldFontCandidates = [
    path.join(process.cwd(), "public", "fonts", "Inter-Bold.ttf"),
    path.join(process.cwd(), "public", "fonts", "Inter-Regular.ttf"),
    path.join(process.cwd(), "public", "fonts", "noto-sans-regular.ttf"),
  ];
  const fontRegular = fontCandidates.find((candidate) => fs.existsSync(candidate));
  const fontBold = boldFontCandidates.find((candidate) => fs.existsSync(candidate));
  if (!fontRegular || !fontBold) {
    throw new Error("Missing PDF font files in public/fonts");
  }

  const doc = new PDFDocument({
    size: "A4",
    margin: 28,
    bufferPages: true,
    font: fontRegular,
  });
  doc.registerFont("Body", fontRegular);
  doc.registerFont("BodyBold", fontBold);
  doc.font("Body");

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const title = "Flachenschneeschieber";
  const subtitle = mode === "low" ? "Niedrigbestandbericht" : "Teilelagerbericht";
  const timestamp = formatTimestamp(new Date());
  const showThreshold = items.some((item) => item.warningThreshold !== null);
  const lowCount = items.filter((part) => resolveLowStock(part)).length;
  const categoryCount = new Set(items.map((part) => normalizeCategory(part.category))).size;

  const colors = {
    ink: "#0f172a",
    muted: "#64748b",
    line: "#d8e1ef",
    headBg: "#0f4c81",
    headBgLight: "#1b6aa8",
    tableHeadBg: "#eff6ff",
    categoryBg: "#f8fafc",
    rowAlt: "#f9fbff",
    chipWarn: "#f59e0b",
  };

  const pageLeft = doc.page.margins.left;
  const pageRight = doc.page.width - doc.page.margins.right;
  const contentWidth = pageRight - pageLeft;
  const rowHeight = 16;
  const headerHeight = 74;
  const stockWidth = 58;
  const unitWidth = 56;
  const thresholdWidth = showThreshold ? 58 : 0;
  const nameWidth = contentWidth - stockWidth - unitWidth - thresholdWidth;
  const colX = {
    name: pageLeft,
    stock: pageLeft + nameWidth,
    unit: pageLeft + nameWidth + stockWidth,
    threshold: pageLeft + nameWidth + stockWidth + unitWidth,
  };

  const fitText = (value: string, width: number, fontSize = 8.7) => {
    doc.fontSize(fontSize);
    if (doc.widthOfString(value) <= width) {
      return value;
    }
    const ellipsis = "...";
    let out = value;
    while (out.length > 1 && doc.widthOfString(`${out}${ellipsis}`) > width) {
      out = out.slice(0, -1);
    }
    return `${out}${ellipsis}`;
  };

  const logoCandidates = [
    path.join(process.cwd(), "public", "icons", "icon-192.png"),
    path.join(process.cwd(), "public", "icons", "icon-512.png"),
  ];
  const logoPath = logoCandidates.find((candidate) => fs.existsSync(candidate));

  const drawMainHeader = () => {
    doc
      .save()
      .rect(pageLeft, doc.y, contentWidth, headerHeight)
      .fill(colors.headBg)
      .restore();
    doc
      .save()
      .rect(pageLeft + 180, doc.y + 36, contentWidth - 180, 38)
      .fill(colors.headBgLight)
      .restore();

    const topY = doc.y;
    if (logoPath) {
      try {
        doc.image(logoPath, pageLeft + 14, topY + 11, { fit: [42, 42] });
      } catch {
        // ignore image errors and render header without logo
      }
    }

    doc.font("BodyBold").fontSize(16).fillColor("#ffffff").text(title, pageLeft + 64, topY + 14, {
      width: contentWidth - 74,
    });
    doc.font("Body").fontSize(10).fillColor("#dbeafe").text(subtitle, pageLeft + 64, topY + 38, {
      width: contentWidth - 74,
    });
    doc.y = topY + headerHeight + 8;
  };

  const drawMetaRow = () => {
    doc.font("Body").fontSize(9).fillColor(colors.muted);
    doc.text(`Berichtsdatum: ${timestamp}`, pageLeft, doc.y, { width: contentWidth / 2 });
    doc.text(`Positionen: ${items.length}`, pageLeft + contentWidth / 2, doc.y - 11, {
      width: contentWidth / 2,
      align: "right",
    });
    doc.text(`Kategorien: ${categoryCount}`, pageLeft + contentWidth / 2, doc.y, {
      width: contentWidth / 2,
      align: "right",
    });
    doc.moveDown(0.6);
    doc
      .moveTo(pageLeft, doc.y)
      .lineTo(pageRight, doc.y)
      .strokeColor(colors.line)
      .stroke();
    doc.moveDown(0.4);
  };

  const drawInfoChips = () => {
    const chipY = doc.y;
    const chips = [
      { label: "Modus", value: mode === "low" ? "Niedrigbestand" : "Alle Teile", warn: mode === "low" },
      { label: "Niedrig", value: String(lowCount), warn: lowCount > 0 },
      { label: "Typ", value: "Lager", warn: false },
    ];
    let x = pageLeft;
    chips.forEach((chip) => {
      const label = `${chip.label}: ${chip.value}`;
      doc.font("Body").fontSize(8.5);
      const width = Math.max(86, Math.min(170, doc.widthOfString(label) + 18));
      doc
        .save()
        .roundedRect(x, chipY, width, 18, 9)
        .fill(chip.warn ? "#fff7ed" : "#f1f5f9")
        .restore();
      doc
        .font("BodyBold")
        .fontSize(8.5)
        .fillColor(chip.warn ? colors.chipWarn : "#334155")
        .text(label, x + 9, chipY + 5, { width: width - 12, ellipsis: true });
      x += width + 8;
    });
    doc.y = chipY + 24;
  };

  const drawTableHeader = () => {
    const y = doc.y;
    doc
      .save()
      .rect(pageLeft, y, contentWidth, rowHeight)
      .fill(colors.tableHeadBg)
      .restore();
    doc.font("BodyBold").fontSize(8.5).fillColor("#1e293b");
    doc.text("Teilename", colX.name + 6, y + 4, { width: nameWidth - 8 });
    doc.text("Bestand", colX.stock, y + 4, { width: stockWidth, align: "center" });
    doc.text("Einh.", colX.unit, y + 4, { width: unitWidth, align: "center" });
    if (showThreshold) {
      doc.text("Schwelle", colX.threshold, y + 4, { width: thresholdWidth, align: "center" });
    }
    doc
      .moveTo(pageLeft, y + rowHeight)
      .lineTo(pageRight, y + rowHeight)
      .strokeColor(colors.line)
      .stroke();
    doc.y = y + rowHeight;
  };

  const drawCategoryHeader = (category: string, count: number) => {
    const y = doc.y;
    doc
      .save()
      .rect(pageLeft, y, contentWidth, 17)
      .fill(colors.categoryBg)
      .restore();
    doc.font("BodyBold").fontSize(8.8).fillColor(colors.ink);
    doc.text(category, pageLeft + 6, y + 4, { width: contentWidth - 56, ellipsis: true });
    doc.font("Body").fontSize(8.3).fillColor(colors.muted);
    doc.text(`${count} Stk.`, pageRight - 52, y + 4, { width: 46, align: "right" });
    doc.y = y + 17;
  };

  const drawRow = (part: PdfPart, indexInCategory: number) => {
    const y = doc.y;
    if (indexInCategory % 2 === 1) {
      doc
        .save()
        .rect(pageLeft, y, contentWidth, rowHeight)
        .fill(colors.rowAlt)
        .restore();
    }
    doc.font("Body").fontSize(8.6).fillColor(colors.ink);
    doc.text(fitText(part.name, nameWidth - 10), colX.name + 6, y + 4, {
      width: nameWidth - 10,
      lineBreak: false,
    });
    doc
      .font("BodyBold")
      .fontSize(8.8)
      .fillColor(resolveLowStock(part) ? "#b45309" : colors.ink)
      .text(String(part.stock), colX.stock, y + 4, {
        width: stockWidth,
        align: "center",
        lineBreak: false,
      });
    doc.font("Body").fontSize(8.5).fillColor(colors.muted).text(part.unit, colX.unit, y + 4, {
      width: unitWidth,
      align: "center",
      lineBreak: false,
    });
    if (showThreshold) {
      doc
        .font("Body")
        .fontSize(8.4)
        .fillColor(colors.muted)
        .text(part.warningThreshold !== null ? String(part.warningThreshold) : "-", colX.threshold, y + 4, {
          width: thresholdWidth,
          align: "center",
          lineBreak: false,
        });
    }
    doc
      .moveTo(pageLeft, y + rowHeight)
      .lineTo(pageRight, y + rowHeight)
      .strokeColor(colors.line)
      .stroke();
    doc.y = y + rowHeight;
  };

  const drawPageHeaderCompact = () => {
    doc.font("BodyBold").fontSize(10.5).fillColor(colors.ink).text(subtitle, pageLeft, doc.y, {
      width: contentWidth / 2,
    });
    doc.font("Body").fontSize(8.2).fillColor(colors.muted).text(title, pageLeft + contentWidth / 2, doc.y - 11, {
      width: contentWidth / 2,
      align: "right",
    });
    doc
      .moveTo(pageLeft, doc.y + 2)
      .lineTo(pageRight, doc.y + 2)
      .strokeColor(colors.line)
      .stroke();
    doc.y += 6;
  };

  const categoryMap = new Map<string, PdfPart[]>();
  items.forEach((part) => {
    const category = normalizeCategory(part.category);
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)?.push(part);
  });

  const sortedCategories = Array.from(categoryMap.keys()).sort((a, b) => a.localeCompare(b, "de"));

  drawMainHeader();
  drawMetaRow();
  drawInfoChips();
  drawTableHeader();

  sortedCategories.forEach((category) => {
    const categoryItems = categoryMap.get(category) ?? [];
    if (categoryItems.length === 0) {
      return;
    }

    const sectionHeightNeeded = 17 + rowHeight + 8;
    const sectionHeaderLimit = doc.page.height - doc.page.margins.bottom - sectionHeightNeeded;
    if (doc.y > sectionHeaderLimit) {
      doc.addPage();
      drawPageHeaderCompact();
      drawTableHeader();
    }
    drawCategoryHeader(category, categoryItems.length);

    categoryItems.forEach((part, index) => {
      const bottomLimit = doc.page.height - doc.page.margins.bottom - rowHeight;
      if (doc.y > bottomLimit) {
        doc.addPage();
        drawPageHeaderCompact();
        drawTableHeader();
        drawCategoryHeader(category, categoryItems.length);
      }
      drawRow(part, index);
    });

    doc.y += 6;
  });

  const pageRange = doc.bufferedPageRange();
  for (let index = 0; index < pageRange.count; index += 1) {
    doc.switchToPage(index);
    doc.fontSize(9).fillColor("#666");
    doc.text(
      `Seite ${index + 1} / ${pageRange.count}`,
      doc.page.margins.left,
      doc.page.height - doc.page.margins.bottom + 5,
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

  try {
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

    const filtered = mode === "low" ? parts.filter((part) => resolveLowStock(part)) : parts;
    const pdfBuffer = await buildPdf(mode, filtered);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=\"parts-${mode}.pdf\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation failed:", error);
    return NextResponse.json({ message: "PDF generation failed" }, { status: 500 });
  }
}
