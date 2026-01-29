import type { Lang } from "@/lib/i18n";

type CategoryLabels = Record<string, string>;

const plLabels: CategoryLabels = {
  sruby: "Sruby",
  nakretki: "Nakretki",
  podkladki: "Podkladki",
  bolce: "Bolce",
  hydraulika: "Hydraulika",
  gumy: "Gumy",
  elektryka: "Elektryka",
  cylindry: "Cylindry",
  weze: "Weze",
  inne: "Inne",
};

const deLabels: CategoryLabels = {
  sruby: "Schrauben",
  nakretki: "Muttern",
  podkladki: "Unterlegscheiben",
  bolce: "Bolzen",
  hydraulika: "Hydraulik",
  gumy: "Gummi",
  elektryka: "Elektrik",
  cylindry: "Zylinder",
  weze: "Schlaeuche",
  inne: "Sonstiges",
};

export const translateCategory = (category: string | null | undefined, lang: Lang) => {
  if (!category) {
    return "";
  }
  const trimmed = category.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  if (lang === "de") {
    return deLabels[trimmed] ?? trimmed;
  }
  return plLabels[trimmed] ?? trimmed;
};

export const buildCategoryOptions = (categories: string[], lang: Lang) => {
  const mapped = categories
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .map((value) => ({
      value,
      label: translateCategory(value, lang) || value,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return mapped;
};
