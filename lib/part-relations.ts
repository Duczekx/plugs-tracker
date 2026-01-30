export type SimplePart = {
  id: number;
  name: string;
  category?: string | null;
};

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

const isHvName = (value: string) => {
  const normalized = normalize(value);
  return /\bhv\b/i.test(normalized) || /^hv/i.test(normalized);
};

export const extractMetricSize = (name: string) => {
  const match =
    /\bm\s*(\d{1,2})\b/i.exec(name) || /\bm\s*(\d{1,2})\s*x/i.exec(name);
  if (!match) {
    return null;
  }
  return match[1];
};

const scoreMatch = (name: string, size: string) => {
  const normalized = normalize(name);
  if (normalized.includes(`m${size}`)) {
    return 2;
  }
  if (normalized.includes(`m ${size}`)) {
    return 1;
  }
  return 0;
};

export const findPartBySizeAndCategory = (
  parts: SimplePart[],
  size: string,
  category: string
) => {
  const matches = parts
    .filter((part) => (part.category ?? "").toLowerCase() === category)
    .map((part) => ({ part, score: scoreMatch(part.name, size) }))
    .filter((entry) => entry.score > 0);
  if (matches.length === 0) {
    return null;
  }
  matches.sort((a, b) => b.score - a.score);
  return matches[0].part;
};

const findNutBySize = (parts: SimplePart[], size: string, preferHv: boolean) => {
  const candidates = parts
    .filter((part) => (part.category ?? "").toLowerCase() === "nakretki")
    .map((part) => ({ part, score: scoreMatch(part.name, size) }))
    .filter((entry) => entry.score > 0);
  if (candidates.length === 0) {
    return null;
  }
  const withVariant = candidates.map((entry) => ({
    ...entry,
    isHv: isHvName(entry.part.name),
  }));
  const primary = withVariant.filter((entry) =>
    preferHv ? entry.isHv : !entry.isHv
  );
  const fallback = withVariant.filter((entry) =>
    preferHv ? !entry.isHv : entry.isHv
  );
  const pickFrom = primary.length > 0 ? primary : fallback;
  pickFrom.sort((a, b) => b.score - a.score);
  return pickFrom[0].part;
};

export const buildAutoRelations = (parts: SimplePart[], name: string) => {
  const size = extractMetricSize(name);
  if (!size) {
    return [] as Array<{ part: SimplePart; qty: number }>;
  }
  const preferHv = isHvName(name);
  const washer = findPartBySizeAndCategory(parts, size, "podkladki");
  const nut = findNutBySize(parts, size, preferHv);
  const relations: Array<{ part: SimplePart; qty: number }> = [];
  if (washer) {
    relations.push({ part: washer, qty: 2 });
  }
  if (nut) {
    relations.push({ part: nut, qty: 1 });
  }
  return relations;
};
