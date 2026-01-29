export const normalizeSpaces = (value: string) => value.trim().replace(/\s+/g, " ");

const unique = (values: string[]) => Array.from(new Set(values));

export const parseCategoryParam = (value: string | null | undefined) => {
  if (!value) {
    return [] as string[];
  }
  return unique(
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
};

export const serializeCategoryParam = (values: string[]) =>
  unique(values.map((entry) => entry.trim().toLowerCase()).filter(Boolean)).join(",");

const synonymPairs: Array<[string, string[]]> = [
  ["mutter", ["nakret", "nakretka"]],
  ["nakret", ["mutter", "muttere"]],
  ["scheibe", ["podklad", "unterleg"]],
  ["unterleg", ["scheibe", "podklad"]],
  ["podklad", ["scheibe", "unterleg"]],
  ["zylinder", ["cylinder", "cylindry"]],
  ["cylinder", ["zylinder", "cylindry"]],
  ["cylindry", ["zylinder", "cylinder"]],
  ["weze", ["schlauch", "schlauche", "schlauchschelle", "schlauchschellen", "schlaeuch"]],
  ["schlauch", ["weze", "schlauche", "schlauchschelle", "schlauchschellen", "schlaeuch"]],
  ["schlauche", ["weze", "schlauch", "schlauchschelle", "schlauchschellen", "schlaeuch"]],
  ["schlaeuch", ["weze", "schlauch", "schlauche", "schlauchschelle", "schlauchschellen"]],
];

export const expandSearchTerms = (rawQuery: string) => {
  const query = normalizeSpaces(rawQuery).toLowerCase();
  if (!query) {
    return [] as string[];
  }
  const variants = [query];
  for (const [key, values] of synonymPairs) {
    if (query.includes(key)) {
      variants.push(...values);
    }
  }
  return unique(variants);
};
