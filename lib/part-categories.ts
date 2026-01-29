import type { Lang } from "@/lib/i18n";

type CategoryLabels = Record<string, string>;

const plLabels: CategoryLabels = {
  Hydraulika: "Hydraulika",
  Elektryka: "Elektryka",
  "Sruby i laczniki": "Sruby i laczniki",
  Sworznie: "Sworznie",
  Obejmy: "Obejmy",
  Uszczelnienia: "Uszczelnienia",
  Spawanie: "Spawanie",
  Pakowanie: "Pakowanie",
  Zylinder: "Zylinder",
  Typenschild: "Typenschild",
  Inne: "Inne",
};

const deLabels: CategoryLabels = {
  Hydraulika: "Hydraulik",
  Elektryka: "Elektrik",
  "Sruby i laczniki": "Schrauben",
  Sworznie: "Bolzen",
  Obejmy: "Schellen",
  Uszczelnienia: "Dichtungen",
  Spawanie: "Schweissen",
  Pakowanie: "Verpackung",
  Zylinder: "Zylinder",
  Typenschild: "Typenschild",
  Inne: "Sonstiges",
};

export const translateCategory = (category: string | null | undefined, lang: Lang) => {
  if (!category) {
    return "";
  }
  const trimmed = category.trim();
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
    .map((value) => ({
      value,
      label: translateCategory(value, lang) || value,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return mapped;
};
