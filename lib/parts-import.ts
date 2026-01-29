export type ImportSkipReason =
  | "missing_name"
  | "missing_qty"
  | "model_fl"
  | "orange"
  | "edge_protection"
  | "sticker"
  | "chemistry"
  | "manual_remove"
  | "invalid_row";

export type ImportItem = {
  name: string;
  stock: number;
  category: string;
};

export type ImportSkip = {
  reason: ImportSkipReason;
  name?: string;
};

export type ImportPreview = {
  items: ImportItem[];
  skipped: ImportSkip[];
  headerRowIndex: number;
  nameIndex: number;
  qtyIndex: number;
};

const qtyKeywords = [
  "menge",
  "quantity",
  "qty",
  "ilosc",
  "stuck",
  "stueck",
  "szt",
];

const nameKeywords = [
  "gegenstand",
  "bezeichnung",
  "bezeichung",
  "beschreibung",
  "name",
  "artikel",
  "item",
  "teil",
  "part",
  "komponente",
  "komponent",
];

export const normalizeSpaces = (value: string) => value.trim().replace(/\s+/g, " ");

export const normalizeKey = (value: string) => normalizeSpaces(value).toLowerCase();

const foldForMatch = (value: string) =>
  value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export const parseStock = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/\s/g, "").replace(",", ".");
    if (!cleaned) {
      return null;
    }
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  return null;
};

export const detectHeaderRowIndex = (rows: unknown[][]) =>
  rows.findIndex((row) =>
    row.some((cell) => {
      if (typeof cell !== "string") {
        return false;
      }
      const folded = foldForMatch(cell);
      return qtyKeywords.some((key) => folded.includes(key));
    })
  );

const detectColumnIndex = (headers: unknown[], keywords: string[]) => {
  const normalizedHeaders = headers.map((header) =>
    typeof header === "string" ? foldForMatch(header) : ""
  );
  for (let index = 0; index < normalizedHeaders.length; index += 1) {
    const header = normalizedHeaders[index];
    if (!header) {
      continue;
    }
    if (keywords.some((keyword) => header.includes(keyword))) {
      return index;
    }
  }
  return -1;
};

const hasZylinderWithNumber = (value: string) =>
  /\bzylinder\b/i.test(value) && /\b\d{3,4}\b/.test(value);

export const getSkipReason = (rawName: string): ImportSkipReason | null => {
  const folded = foldForMatch(rawName);
  if (!folded) {
    return "missing_name";
  }

  if (folded.includes("typenschild")) {
    return null;
  }

  if (hasZylinderWithNumber(rawName)) {
    return null;
  }

  const isModel = /\bfl[\s-]*\d+\b/i.test(rawName) || /\bfl[\s-]*\d+\b/.test(folded);
  if (isModel) {
    return "model_fl";
  }
  if (folded.includes("orange") || folded.includes("kommunalorange")) {
    return "orange";
  }
  if (
    folded.includes("kantenschutz") ||
    folded.includes("schutzkante") ||
    folded.includes("schutz") ||
    folded.includes("oslona") ||
    folded.includes("ochrona krawedzi")
  ) {
    return "edge_protection";
  }
  if (
    folded.includes("aufkleber") ||
    folded.includes("warnung") ||
    folded.includes("warnhinweis") ||
    folded.includes("sticker") ||
    folded.includes("etikett") ||
    folded.includes("label")
  ) {
    return "sticker";
  }
  if (
    folded.includes("fett") ||
    folded.includes("oel") ||
    folded.includes("oil") ||
    folded.includes("spray") ||
    folded.includes("reiniger") ||
    folded.includes("cleaner") ||
    folded.includes("kleber") ||
    folded.includes("loctite") ||
    folded.includes("schmier")
  ) {
    return "chemistry";
  }
  return null;
};

export const guessCategory = (rawName: string) => {
  const folded = foldForMatch(rawName);
  if (
    folded.includes("schraub") ||
    folded.includes("sruba") ||
    folded.includes("sruby") ||
    folded.includes("bolt") ||
    folded.includes("imbus") ||
    folded.includes("torx") ||
    /^m\d+/i.test(normalizeSpaces(rawName))
  ) {
    return "Sruby i laczniki";
  }
  if (
    folded.includes("bolzen") ||
    folded.includes("sworzen") ||
    folded.includes("pin")
  ) {
    return "Sworznie";
  }
  if (
    folded.includes("schelle") ||
    folded.includes("klemme") ||
    folded.includes("obejma") ||
    folded.includes("uchwyt")
  ) {
    return "Obejmy";
  }
  if (
    folded.includes("dichtung") ||
    folded.includes("uszczelka") ||
    folded.includes("oring") ||
    folded.includes("o-ring") ||
    folded.includes("simmering")
  ) {
    return "Uszczelnienia";
  }
  if (
    folded.includes("schweiss") ||
    folded.includes("spaw") ||
    folded.includes("weld")
  ) {
    return "Spawanie";
  }
  if (
    folded.includes("karton") ||
    folded.includes("carton") ||
    folded.includes("box") ||
    folded.includes("verpack") ||
    folded.includes("pack")
  ) {
    return "Pakowanie";
  }
  if (folded.includes("typenschild")) {
    return "Typenschild";
  }
  if (folded.includes("zylinder")) {
    return "Zylinder";
  }
  if (
    folded.includes("kabel") ||
    folded.includes("leitung") ||
    folded.includes("stecker") ||
    folded.includes("schalter") ||
    folded.includes("wippschalter") ||
    folded.includes("stossverbinder") ||
    folded.includes("lampe") ||
    folded.includes("leuchte")
  ) {
    return "Elektryka";
  }
  if (
    folded.includes("mutter") ||
    folded.includes("nakretk") ||
    folded.includes("nut")
  ) {
    return "Nakretki";
  }
  if (
    folded.includes("scheibe") ||
    folded.includes("podkladk") ||
    folded.includes("washer")
  ) {
    return "Podkladki";
  }
  if (
    folded.includes("hydraul") ||
    folded.includes("ventil") ||
    folded.includes("pumpe") ||
    folded.includes("kupplung") ||
    folded.includes("schlauch")
  ) {
    return "Hydraulika";
  }
  return "Inne";
};

export const buildImportPreview = (rows: unknown[][]): ImportPreview => {
  const headerRowIndex = detectHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    return {
      items: [],
      skipped: [{ reason: "invalid_row" }],
      headerRowIndex: -1,
      nameIndex: -1,
      qtyIndex: -1,
    };
  }

  const headers = rows[headerRowIndex] ?? [];
  const qtyIndex = detectColumnIndex(headers, qtyKeywords);
  const nameIndex = detectColumnIndex(headers, nameKeywords);

  if (qtyIndex < 0 || nameIndex < 0) {
    return {
      items: [],
      skipped: [{ reason: "invalid_row" }],
      headerRowIndex,
      nameIndex,
      qtyIndex,
    };
  }

  const itemsByKey = new Map<string, ImportItem>();
  const order: string[] = [];
  const skipped: ImportSkip[] = [];

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const rawName = typeof row[nameIndex] === "string" ? row[nameIndex] : String(row[nameIndex] ?? "");
    const cleanedName = normalizeSpaces(rawName);
    if (!cleanedName) {
      skipped.push({ reason: "missing_name" });
      continue;
    }

    const skipReason = getSkipReason(cleanedName);
    if (skipReason) {
      skipped.push({ reason: skipReason, name: cleanedName });
      continue;
    }

    const stock = parseStock(row[qtyIndex]);
    if (stock === null || !Number.isFinite(stock)) {
      skipped.push({ reason: "missing_qty", name: cleanedName });
      continue;
    }

    const key = normalizeKey(cleanedName);
    const category = guessCategory(cleanedName);
    if (!itemsByKey.has(key)) {
      order.push(key);
    }
    itemsByKey.set(key, { name: cleanedName, stock, category });
  }

  return {
    items: order.map((key) => itemsByKey.get(key)).filter(Boolean) as ImportItem[],
    skipped,
    headerRowIndex,
    nameIndex,
    qtyIndex,
  };
};
