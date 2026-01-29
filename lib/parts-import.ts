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

export const normalizeCategory = (value: string) => {
  const cleaned = normalizeSpaces(value).toLowerCase();
  if (!cleaned) {
    return "inne";
  }
  const tokens = cleaned.split(" ").filter(Boolean);
  const unique = new Set(tokens);
  if (unique.size === 1) {
    return tokens[0];
  }
  if (cleaned === "inne inne") {
    return "inne";
  }
  return cleaned;
};

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
  const compact = normalizeSpaces(rawName);

  if (/\bM(?:[3-9]|[12]\d|30)\b/i.test(compact) || /\bM(?:[3-9]|[12]\d|30)\s*x/i.test(compact)) {
    return "sruby";
  }
  if (folded.includes("mutter") || folded.includes("nakret")) {
    return "nakretki";
  }
  if (folded.includes("scheibe") || folded.includes("unterleg") || folded.includes("podklad")) {
    return "podkladki";
  }
  if (
    folded.includes("bolzen") ||
    folded.includes("splint") ||
    folded.includes("sicherungsblech")
  ) {
    return "bolce";
  }
  if (
    folded.includes("gummi") ||
    folded.includes("gumm") ||
    folded.includes("dichtung") ||
    folded.includes("o-ring") ||
    folded.includes("oring")
  ) {
    return "gumy";
  }
  if (
    folded.includes("kabel") ||
    folded.includes("stecker") ||
    folded.includes("schalter") ||
    folded.includes("relais") ||
    folded.includes("sicherung") ||
    folded.includes("klemme") ||
    folded.includes("kabelbinder") ||
    folded.includes("isolier")
  ) {
    return "elektryka";
  }
  if (
    folded.includes("hydraul") ||
    folded.includes("schlauch") ||
    folded.includes("ventil") ||
    folded.includes("zylinder") ||
    folded.includes("kupplung") ||
    folded.includes("drossel") ||
    folded.includes("manometer") ||
    folded.includes("fitting")
  ) {
    return "hydraulika";
  }
  return "inne";
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
    const category = normalizeCategory(guessCategory(cleanedName));
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
