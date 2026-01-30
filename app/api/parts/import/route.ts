import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { blockIfReadOnly } from "@/lib/access";
import { blockIfNotAdmin } from "@/lib/admin-auth";
import { sendPushToRolesByKey } from "@/lib/push";
import {
  buildImportPreview,
  getSkipReason,
  guessCategory,
  normalizeCategory,
  normalizeKey,
  normalizeSpaces,
  parseStock,
  ImportItem,
  ImportSkip,
  ImportSkipReason,
} from "@/lib/parts-import";

export const runtime = "nodejs";

const MAX_EXAMPLES = 6;

const pushExample = (list: string[], name?: string) => {
  if (!name) {
    return;
  }
  if (list.length >= MAX_EXAMPLES) {
    return;
  }
  if (!list.includes(name)) {
    list.push(name);
  }
};

const summarizeSkips = (skipped: ImportSkip[]) => {
  const counts: Record<ImportSkipReason, number> = {
    missing_name: 0,
    missing_qty: 0,
    model_fl: 0,
    orange: 0,
    edge_protection: 0,
    sticker: 0,
    chemistry: 0,
    manual_remove: 0,
    invalid_row: 0,
  };
  const examples: Record<ImportSkipReason, string[]> = {
    missing_name: [],
    missing_qty: [],
    model_fl: [],
    orange: [],
    edge_protection: [],
    sticker: [],
    chemistry: [],
    manual_remove: [],
    invalid_row: [],
  };

  skipped.forEach((entry) => {
    counts[entry.reason] += 1;
    pushExample(examples[entry.reason], entry.name);
  });

  return { counts, examples };
};

const collectItemsFromJson = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return { items: [], skipped: [{ reason: "invalid_row" } as ImportSkip] };
  }
  const itemsInput = Array.isArray((payload as { items?: unknown }).items)
    ? (payload as { items: unknown[] }).items
    : [];
  const items: ImportItem[] = [];
  const skipped: ImportSkip[] = [];

  itemsInput.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      skipped.push({ reason: "invalid_row" });
      return;
    }
    const rawName = String((entry as { name?: unknown }).name ?? "");
    const cleanedName = normalizeSpaces(rawName);
    if (!cleanedName) {
      skipped.push({ reason: "missing_name" });
      return;
    }
    const skipReason = getSkipReason(cleanedName);
    if (skipReason) {
      skipped.push({ reason: skipReason, name: cleanedName });
      return;
    }
    const stockValue = parseStock((entry as { stock?: unknown }).stock);
    if (stockValue === null || !Number.isFinite(stockValue)) {
      skipped.push({ reason: "missing_qty", name: cleanedName });
      return;
    }
    const categoryInput = (entry as { category?: unknown }).category;
    const category = normalizeCategory(
      typeof categoryInput === "string" && categoryInput.trim()
        ? normalizeSpaces(categoryInput)
        : guessCategory(cleanedName)
    );
    items.push({ name: cleanedName, stock: stockValue, category });
  });

  return { items, skipped };
};

export async function POST(request: NextRequest) {
  const blocked = blockIfReadOnly(request);
  if (blocked) {
    return blocked;
  }
  const adminBlocked = await blockIfNotAdmin(request);
  if (adminBlocked) {
    return adminBlocked;
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let items: ImportItem[] = [];
    let skipped: ImportSkip[] = [];

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);
      const result = collectItemsFromJson(body);
      items = result.items;
      skipped = result.skipped;
    } else {
      const formData = await request.formData().catch(() => null);
      const file = formData?.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ message: "Missing file" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return NextResponse.json({ message: "Empty workbook" }, { status: 400 });
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      const preview = buildImportPreview(rows);
      if (preview.nameIndex < 0 || preview.qtyIndex < 0) {
        return NextResponse.json({ message: "Header row not found" }, { status: 400 });
      }
      items = preview.items;
      skipped = preview.skipped;
    }

    const existing = await prisma.part.findMany({
      select: { id: true, name: true },
    });
    const existingByName = new Map<string, { id: number; name: string }>();
    existing.forEach((part) => {
      const key = normalizeKey(part.name);
      if (key) {
        existingByName.set(key, { id: part.id, name: part.name });
      }
    });

    const pendingCreates = new Map<string, ImportItem>();
    const pendingUpdates = new Map<number, { name: string; stock: number }>();
    const createdExamples: string[] = [];
    const updatedExamples: string[] = [];

    items.forEach((item) => {
      const normalizedKey = normalizeKey(item.name);
      if (!normalizedKey) {
        skipped.push({ reason: "missing_name", name: item.name });
        return;
      }
      const existingPart = existingByName.get(normalizedKey);
      if (existingPart) {
        pendingUpdates.set(existingPart.id, { name: existingPart.name, stock: item.stock });
        pushExample(updatedExamples, existingPart.name);
      } else {
        pendingCreates.set(normalizedKey, item);
        pushExample(createdExamples, item.name);
      }
    });

    const operations = [
      ...Array.from(pendingUpdates.entries()).map(([id, data]) =>
        prisma.part.update({
          where: { id },
          data: { stock: data.stock },
        })
      ),
      ...Array.from(pendingCreates.values()).map((data) =>
        prisma.part.create({
          data: {
            name: data.name,
            stock: data.stock,
            unit: "szt",
            category: data.category,
          },
        })
      ),
    ];

    const chunkSize = 100;
    for (let i = 0; i < operations.length; i += chunkSize) {
      await prisma.$transaction(operations.slice(i, i + chunkSize));
    }

    const { counts, examples } = summarizeSkips(skipped);

    return NextResponse.json({
      createdCount: pendingCreates.size,
      updatedCount: pendingUpdates.size,
      skippedCount: skipped.length,
      createdExamples,
      updatedExamples,
      skippedExamples: skipped.map((entry) => entry.name).filter(Boolean).slice(0, MAX_EXAMPLES),
      skippedReasonCounts: counts,
      skippedReasonExamples: examples,
    });
  } catch (error) {
    try {
      await sendPushToRolesByKey(
        ["VIEWER", "EDITOR"],
        "importErrors",
        "importErrors"
      );
    } catch {
      // ignore push errors
    }
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
