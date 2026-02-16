"use client";

// Admin parts UI uses shared filters (URL-synced) and a BOM part picker modal.

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { labels, Lang } from "@/lib/i18n";
import PartsTable from "@/components/PartsTable";
import { buildCategoryOptions, translateCategory } from "@/lib/part-categories";
import PartsToolbar from "@/components/PartsToolbar";
import PartPickerModal, { PartPickerPart } from "@/components/PartPickerModal";
import { buildAutoRelations } from "@/lib/part-relations";
import { usePartsFilters } from "@/lib/use-parts-filters";
import { serializeCategoryParam } from "@/lib/parts-search";
import {
  buildImportPreview,
  ImportItem,
  ImportSkip,
  ImportSkipReason,
} from "@/lib/parts-import";

type Part = {
  id: number;
  name: string;
  stock: number;
  unit: string;
  category?: string | null;
  shopUrl?: string | null;
  shopName?: string | null;
  isArchived?: boolean;
};

type BomItem = {
  partId: number;
  qtyPerPlow: number;
  part?: { name: string; category?: string | null };
};

type BomType = "STANDARD" | "ADDON_6_2" | "SCHWENKBOCK_3000" | "SCHWENKBOCK_2000";

type Movement = {
  id: number;
  partId: number;
  delta: number;
  reason: string;
  shipmentId?: number | null;
  createdAt: string;
  part: { name: string };
};

type PartsResponse = {
  items: Part[];
  page: number;
  totalPages: number;
  totalCount: number;
};

type MovementsResponse = {
  items: Movement[];
  page: number;
  totalPages: number;
  totalCount: number;
};

type ImportResult = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  createdExamples: string[];
  updatedExamples: string[];
  skippedExamples: string[];
  skippedReasonCounts: Record<ImportSkipReason, number>;
  skippedReasonExamples: Record<ImportSkipReason, string[]>;
};

type ImportPreviewItem = ImportItem & { id: string };

type ImportSkipSummary = {
  counts: Record<ImportSkipReason, number>;
  examples: Record<ImportSkipReason, string[]>;
};

const models = ["FL 640", "FL 540", "FL 470", "FL 400", "FL 340", "FL 260"];
const schwenkOptions: { value: BomType; label: string }[] = [
  { value: "SCHWENKBOCK_3000", label: "Schwenkbock 3000" },
  { value: "SCHWENKBOCK_2000", label: "Schwenkbock 2000" },
];
const bomTypeOptions: { value: BomType; label: string }[] = [
  { value: "STANDARD", label: "Standard" },
  { value: "ADDON_6_2", label: "6/2" },
  ...schwenkOptions,
];

const PAGE_SIZE = 50;

type BomGroupKey = "fasteners" | "electric" | "parts" | "hydraulics" | "other";

const normalizeBomCategory = (category?: string | null) => {
  const trimmed = category?.trim().toLowerCase() ?? "";
  if (!trimmed) return "inne";
  const aliasMap: Record<string, string> = {
    schrauben: "sruby",
    muttern: "nakretki",
    unterlegscheiben: "podkladki",
    bolzen: "bolce",
    hydraulik: "hydraulika",
    gummi: "gumy",
    elektrik: "elektryka",
    zylinder: "cylindry",
    schlaeuche: "weze",
    schlaeuchen: "weze",
    sonstiges: "inne",
  };
  return aliasMap[trimmed] ?? trimmed;
};

const foldForBomMatch = (value: string) =>
  value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const inferBomGroupFromName = (name: string): BomGroupKey => {
  const folded = foldForBomMatch(name);

  if (
    folded.includes("hydraul") ||
    folded.includes("schlauch") ||
    folded.includes("schluch") ||
    folded.includes("schlau") ||
    folded.includes("kupplung") ||
    folded.includes("fitting") ||
    folded.includes("verschraubung") ||
    folded.includes("einschrauber") ||
    folded.includes("muffe")
  ) {
    return "hydraulics";
  }
  if (
    folded.includes("schraub") ||
    folded.includes("nakret") ||
    folded.includes("mutter") ||
    folded.includes("podklad") ||
    folded.includes("scheibe") ||
    /\bm(?:[3-9]|[12]\d|30)\b/i.test(name)
  ) {
    return "fasteners";
  }
  if (
    folded.includes("kabel") ||
    folded.includes("lampe") ||
    folded.includes("leuchte") ||
    folded.includes("stecker") ||
    folded.includes("schalter") ||
    folded.includes("relais")
  ) {
    return "electric";
  }
  if (
    folded.includes("zylinder") ||
    folded.includes("bolzen") ||
    folded.includes("splint") ||
    folded.includes("pin") ||
    folded.includes("link pin") ||
    folded.includes("flag") ||
    folded.includes("gummi") ||
    folded.includes("buchse")
  ) {
    return "parts";
  }
  return "other";
};

const getBomGroupKey = (item: BomItem): BomGroupKey => {
  const normalized = normalizeBomCategory(item.part?.category);
  if (normalized === "sruby" || normalized === "nakretki" || normalized === "podkladki") {
    return "fasteners";
  }
  if (normalized === "elektryka") {
    return "electric";
  }
  if (normalized === "hydraulika" || normalized === "weze") {
    return "hydraulics";
  }
  if (normalized === "cylindry" || normalized === "bolce" || normalized === "gumy") {
    return "parts";
  }
  return inferBomGroupFromName(item.part?.name ?? String(item.partId));
};

export default function AdminPanel() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>("pl");
  const [tab, setTab] = useState<"bom" | "parts" | "movements">("bom");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const [standardModel, setStandardModel] = useState(models[0]);
  const [addonModel, setAddonModel] = useState(models[0]);
  const [schwenkType, setSchwenkType] = useState<BomType>("SCHWENKBOCK_3000");

  const [standardItems, setStandardItems] = useState<BomItem[]>([]);
  const [addonItems, setAddonItems] = useState<BomItem[]>([]);
  const [schwenkItems, setSchwenkItems] = useState<BomItem[]>([]);

  const [standardPartQuery, setStandardPartQuery] = useState("");
  const [addonPartQuery, setAddonPartQuery] = useState("");
  const [schwenkPartQuery, setSchwenkPartQuery] = useState("");
  const [bomPartOptions, setBomPartOptions] = useState<Part[]>([]);

  const [standardQty, setStandardQty] = useState(1);
  const [addonQty, setAddonQty] = useState(1);
  const [schwenkQty, setSchwenkQty] = useState(1);
  const [isSavingStandard, setIsSavingStandard] = useState(false);
  const [isSavingAddon, setIsSavingAddon] = useState(false);
  const [isSavingSchwenk, setIsSavingSchwenk] = useState(false);
  const [standardJson, setStandardJson] = useState("");
  const [addonJson, setAddonJson] = useState("");
  const [schwenkJson, setSchwenkJson] = useState("");
  const [standardJsonError, setStandardJsonError] = useState<string | null>(null);
  const [addonJsonError, setAddonJsonError] = useState<string | null>(null);
  const [schwenkJsonError, setSchwenkJsonError] = useState<string | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<{
    bomType: BomType;
    modelName: string;
    items: BomItem[];
  } | null>(null);
  const [duplicateModelName, setDuplicateModelName] = useState("");
  const [duplicateBomType, setDuplicateBomType] = useState<BomType>("STANDARD");
  const [duplicateKeepType, setDuplicateKeepType] = useState(true);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [duplicateNeedsOverwrite, setDuplicateNeedsOverwrite] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const [parts, setParts] = useState<Part[]>([]);
  const [partsPage, setPartsPage] = useState(1);
  const [partsTotalPages, setPartsTotalPages] = useState(1);
  const [partsTotalCount, setPartsTotalCount] = useState(0);
  const [isPartsLoading, setIsPartsLoading] = useState(false);
  const [partsCategories, setPartsCategories] = useState<string[]>([]);
  const [isPartPickerOpen, setIsPartPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<BomType>("STANDARD");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewItem[]>([]);
  const [importSkipped, setImportSkipped] = useState<ImportSkip[]>([]);
  const [manualSkipped, setManualSkipped] = useState<ImportSkip[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPreviewError, setImportPreviewError] = useState<string | null>(null);
  const [newPart, setNewPart] = useState({
    name: "",
    stock: 0,
    unit: "szt",
    category: "inne",
    shopUrl: "",
    shopName: "",
  });
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [editPartForm, setEditPartForm] = useState({
    name: "",
    unit: "",
    category: "inne",
    shopUrl: "",
    shopName: "",
    stockAbsolute: "",
  });
  const [adjustTarget, setAdjustTarget] = useState<Part | null>(null);
  const [adjustForm, setAdjustForm] = useState({ delta: "", note: "" });

  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsTotalPages, setMovementsTotalPages] = useState(1);
  const [movementFilterInput, setMovementFilterInput] = useState({
    reason: "",
    shipmentId: "",
    from: "",
    to: "",
  });
  const [movementFilters, setMovementFilters] = useState(movementFilterInput);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("plugs-tracker-lang");
      if (stored === "pl" || stored === "de") {
        setLang(stored);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("plugs-tracker-lang", lang);
    } catch {}
  }, [lang]);

  const t = labels[lang];
  const bomUi = {
    copy: lang === "pl" ? "Kopiuj BOM" : "BOM kopieren",
    paste: lang === "pl" ? "Wklej i zaladuj" : "Einfugen & laden",
    duplicate: lang === "pl" ? "Duplikuj BOM" : "BOM duplizieren",
    jsonLabel: lang === "pl" ? "JSON BOM" : "BOM JSON",
    jsonPlaceholder:
      lang === "pl"
        ? '{ "modelName": "FL 540", "bomType": "STANDARD", "items": [{"partId":1,"qtyPerPlow":2}] }'
        : '{ "modelName": "FL 540", "bomType": "STANDARD", "items": [{"partId":1,"qtyPerPlow":2}] }',
    jsonInvalid: lang === "pl" ? "Nieprawidlowy JSON BOM." : "Ungultiges BOM-JSON.",
    jsonMissingItems:
      lang === "pl" ? "Brak items[] w BOM." : "items[] im BOM fehlt.",
    jsonMissingModel:
      lang === "pl" ? "Brak modelName." : "modelName fehlt.",
    jsonInvalidType:
      lang === "pl" ? "Nieprawidlowy bomType." : "Ungultiger bomType.",
    jsonInvalidPartId:
      lang === "pl" ? "partId musi byc liczba > 0." : "partId muss > 0 sein.",
    jsonInvalidQty:
      lang === "pl" ? "qtyPerPlow musi byc liczba > 0." : "qtyPerPlow muss > 0 sein.",
    jsonReplaceConfirm:
      lang === "pl"
        ? "Wczytanie podmieni obecne pozycje BOM. Kontynuowac?"
        : "Das Laden ersetzt die aktuellen BOM-Positionen. Fortfahren?",
    jsonCopied: lang === "pl" ? "Skopiowano BOM." : "BOM kopiert.",
    jsonLoaded: lang === "pl" ? "Wczytano pozycje BOM." : "BOM-Positionen geladen.",
    duplicateTitle: lang === "pl" ? "Duplikuj BOM" : "BOM duplizieren",
    duplicateModelLabel: lang === "pl" ? "Nowy modelName" : "Neuer modelName",
    duplicateTypeLabel: lang === "pl" ? "Nowy bomType" : "Neuer bomType",
    duplicateKeepType: lang === "pl" ? "Zachowaj ten sam bomType" : "BomType beibehalten",
    duplicateCreate: lang === "pl" ? "Utworz kopie" : "Kopie erstellen",
    duplicateOverwrite: lang === "pl" ? "Nadpisz" : "Uberschreiben",
    duplicateExists:
      lang === "pl"
        ? "Docelowy BOM juz istnieje. Czy chcesz go nadpisac?"
        : "Ziel-BOM existiert bereits. Uberschreiben?",
    duplicateMissing:
      lang === "pl" ? "Podaj docelowy modelName." : "Bitte Ziel-modelName angeben.",
  };

  const isGlobalBomType = (bomType: BomType) =>
    bomType === "SCHWENKBOCK_3000" || bomType === "SCHWENKBOCK_2000";

  const getNormalizedModelName = (bomType: BomType, modelName: string) =>
    isGlobalBomType(bomType) ? "GLOBAL" : modelName;

  const getBomTypeLabel = (bomType: BomType) => {
    const match = bomTypeOptions.find((option) => option.value === bomType);
    return match ? match.label : bomType;
  };

  const bomGroupLabels: Record<BomGroupKey, string> = {
    fasteners: `${t.categorySruby} / ${t.categoryPodkladki} / ${t.categoryNakretki}`,
    electric: t.categoryElektryka,
    parts: lang === "pl" ? "Czesci" : "Teile",
    hydraulics: t.categoryHydraulika,
    other: t.categoryInne,
  };

  const groupBomItems = (items: BomItem[]) => {
    const grouped: Record<BomGroupKey, BomItem[]> = {
      fasteners: [],
      electric: [],
      parts: [],
      hydraulics: [],
      other: [],
    };

    items.forEach((item) => {
      grouped[getBomGroupKey(item)].push(item);
    });

    const order: BomGroupKey[] = ["fasteners", "electric", "parts", "hydraulics", "other"];
    return order
      .map((key) => ({
        key,
        label: bomGroupLabels[key],
        items: grouped[key].sort((a, b) => {
          const left = a.part?.name ?? String(a.partId);
          const right = b.part?.name ?? String(b.partId);
          return left.localeCompare(right);
        }),
      }))
      .filter((group) => group.items.length > 0);
  };

  const renderGroupedBomRows = (
    items: BomItem[],
    setItems: (items: BomItem[]) => void,
    bomType: BomType,
    modelName: string,
    setSaving: (value: boolean) => void,
    isSaving: boolean
  ) => {
    if (items.length === 0) {
      return (
        <tr>
          <td colSpan={3} className="muted">
            {t.bomEmpty}
          </td>
        </tr>
      );
    }

    const groups = groupBomItems(items);
    return groups.flatMap((group) => [
      <tr key={`group-${group.key}`} className="bom-group-row">
        <td colSpan={3}>
          <span className="bom-group-pill">{group.label}</span>
        </td>
      </tr>,
      ...group.items.map((item) => (
        <tr key={`${group.key}-${item.partId}`}>
          <td>{item.part?.name ?? item.partId}</td>
          <td>{item.qtyPerPlow}</td>
          <td>
            <button
              type="button"
              className="button button-ghost button-small"
              onClick={() =>
                removeBomItem(
                  item.partId,
                  items,
                  setItems,
                  bomType,
                  modelName,
                  setSaving,
                  isSaving
                )
              }
            >
              {t.delete}
            </button>
          </td>
        </tr>
      )),
    ]);
  };

  const importReasonLabels: Record<ImportSkipReason, string> = {
    missing_name: t.partsImportReasonMissingName,
    missing_qty: t.partsImportReasonMissingQty,
    model_fl: t.partsImportReasonModel,
    orange: t.partsImportReasonOrange,
    edge_protection: t.partsImportReasonEdge,
    sticker: t.partsImportReasonSticker,
    chemistry: t.partsImportReasonChem,
    manual_remove: t.partsImportReasonManual,
    invalid_row: t.partsImportReasonInvalid,
  };

  const summarizeSkips = (skipped: ImportSkip[]): ImportSkipSummary => {
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
      if (entry.name && examples[entry.reason].length < 5) {
        if (!examples[entry.reason].includes(entry.name)) {
          examples[entry.reason].push(entry.name);
        }
      }
    });

    return { counts, examples };
  };

  const previewSummary = summarizeSkips([...importSkipped, ...manualSkipped]);


  const loadBomByType = async (bomType: BomType, modelName: string) => {
    const params = new URLSearchParams();
    params.set("bomType", bomType);
    if (modelName) {
      params.set("modelName", modelName);
    }
    const response = await fetch(`/api/bom?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    return data.bom?.items ?? [];
  };

  useEffect(() => {
    if (tab !== "bom") {
      return;
    }
    loadBomByType("STANDARD", standardModel)
      .then(setStandardItems)
      .catch(() => {
        setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
      });
  }, [tab, standardModel]);

  useEffect(() => {
    if (tab !== "bom") {
      return;
    }
    loadBomByType("ADDON_6_2", addonModel)
      .then(setAddonItems)
      .catch(() => {
        setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
      });
  }, [tab, addonModel]);

  useEffect(() => {
    if (tab !== "bom") {
      return;
    }
    loadBomByType(schwenkType, "")
      .then(setSchwenkItems)
      .catch(() => {
        setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
      });
  }, [tab, schwenkType]);

  const partsFilters = usePartsFilters({ debounceMs: 300, enabled: tab === "parts" });

  const loadParts = async (
    page: number,
    query: string,
    categories: string[],
    sort: string
  ) => {
    setIsPartsLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per", String(PAGE_SIZE));
    params.set("sort", sort);
    if (query) {
      params.set("q", query);
    }
    if (categories.length) {
      params.set("cat", serializeCategoryParam(categories));
    }
    const response = await fetch(`/api/parts?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: PartsResponse = await response.json();
    setParts(data.items);
    setPartsPage(data.page);
    setPartsTotalPages(data.totalPages);
    setPartsTotalCount(data.totalCount);
    setIsPartsLoading(false);
  };

  useEffect(() => {
    if (tab !== "parts") {
      return;
    }
    loadParts(1, partsFilters.query, partsFilters.categories, partsFilters.sort).catch(() => {
      setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
      setIsPartsLoading(false);
    });
  }, [tab, partsFilters.query, partsFilters.categories, partsFilters.sort]);

  useEffect(() => {
    if (tab !== "parts") {
      return;
    }
    const fetchCategories = async () => {
      const response = await fetch("/api/parts/categories", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (Array.isArray(data.categories)) {
        setPartsCategories(
          data.categories.filter((value: unknown): value is string => typeof value === "string")
        );
      }
    };
    fetchCategories().catch(() => null);
  }, [tab]);

  const loadPartOptions = async (query: string) => {
    const params = new URLSearchParams();
    params.set("per", "200");
    if (query) {
      params.set("q", query);
    }
    const response = await fetch(`/api/parts?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const data: PartsResponse = await response.json();
    setBomPartOptions(data.items);
  };

  useEffect(() => {
    if (tab !== "bom") {
      return;
    }
    loadPartOptions(standardPartQuery).catch(() => null);
  }, [tab, standardPartQuery]);

  useEffect(() => {
    if (tab !== "bom") {
      return;
    }
    loadPartOptions(addonPartQuery).catch(() => null);
  }, [tab, addonPartQuery]);

  useEffect(() => {
    if (tab !== "bom") {
      return;
    }
    loadPartOptions(schwenkPartQuery).catch(() => null);
  }, [tab, schwenkPartQuery]);

  const saveBomItems = async (
    bomType: BomType,
    modelName: string,
    nextItems: BomItem[],
    setItems: (items: BomItem[]) => void,
    setSaving: (value: boolean) => void,
    isSaving: boolean
  ) => {
    if (isSaving) {
      return;
    }
    setSaving(true);
    const response = await fetch("/api/bom", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelName,
        bomType,
        items: nextItems.map((item) => ({
          partId: item.partId,
          qtyPerPlow: item.qtyPerPlow,
        })),
      }),
    });
    if (!response.ok) {
      setNotice({ type: "error", message: t.error });
      setSaving(false);
      return;
    }
    const data = await response.json();
    setItems(data.bom?.items ?? []);
    setNotice({ type: "success", message: t.saved });
    setSaving(false);
  };

  const buildBomPayload = (bomType: BomType, modelName: string, items: BomItem[]) =>
    JSON.stringify(
      {
        modelName: getNormalizedModelName(bomType, modelName),
        bomType,
        items: items.map((item) => ({
          partId: item.partId,
          qtyPerPlow: item.qtyPerPlow,
        })),
      },
      null,
      2
    );

  const copyBomToClipboard = async (bomType: BomType, modelName: string, items: BomItem[]) => {
    try {
      await navigator.clipboard.writeText(buildBomPayload(bomType, modelName, items));
      setNotice({ type: "success", message: bomUi.jsonCopied });
    } catch {
      setNotice({ type: "error", message: t.error });
    }
  };

  const parseBomJson = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return { items: null, error: bomUi.jsonInvalid };
    }
    let parsed: {
      modelName?: string;
      bomType?: BomType;
      items?: Array<{ partId: number; qtyPerPlow: number }>;
    };
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { items: null, error: bomUi.jsonInvalid };
    }
    if (!parsed || typeof parsed.modelName !== "string" || !parsed.modelName.trim()) {
      return { items: null, error: bomUi.jsonMissingModel };
    }
    const allowedTypes = new Set(bomTypeOptions.map((option) => option.value));
    if (!parsed.bomType || !allowedTypes.has(parsed.bomType)) {
      return { items: null, error: bomUi.jsonInvalidType };
    }
    if (!parsed.items || !Array.isArray(parsed.items)) {
      return { items: null, error: bomUi.jsonMissingItems };
    }
    const normalized = parsed.items.map((item) => ({
      partId: Number(item.partId),
      qtyPerPlow: Number(item.qtyPerPlow),
    }));
    for (const item of normalized) {
      if (!Number.isInteger(item.partId) || item.partId <= 0) {
        return { items: null, error: bomUi.jsonInvalidPartId };
      }
      if (!Number.isFinite(item.qtyPerPlow) || item.qtyPerPlow <= 0) {
        return { items: null, error: bomUi.jsonInvalidQty };
      }
    }
    return { items: normalized, error: null };
  };

  const applyBomJson = (
    value: string,
    setItems: (items: BomItem[]) => void,
    setError: (value: string | null) => void,
    currentItems: BomItem[]
  ) => {
    const result = parseBomJson(value);
    if (!result.items) {
      setError(result.error ?? bomUi.jsonInvalid);
      return;
    }
    if (currentItems.length > 0) {
      const confirmed = window.confirm(bomUi.jsonReplaceConfirm);
      if (!confirmed) {
        return;
      }
    }
    const nextItems: BomItem[] = result.items.map((item) => {
      const match = bomPartOptions.find((part) => part.id === item.partId);
      return {
        partId: item.partId,
        qtyPerPlow: item.qtyPerPlow,
        part: match ? { name: match.name, category: match.category ?? null } : undefined,
      };
    });
    setItems(nextItems);
    setError(null);
    setNotice({ type: "success", message: bomUi.jsonLoaded });
  };

  const openDuplicateModal = (bomType: BomType, modelName: string, items: BomItem[]) => {
    setDuplicateSource({ bomType, modelName, items });
    setDuplicateKeepType(true);
    setDuplicateBomType(bomType);
    setDuplicateModelName(modelName);
    setDuplicateWarning(null);
    setDuplicateNeedsOverwrite(false);
  };

  const confirmDuplicate = async () => {
    if (!duplicateSource || isDuplicating) {
      return;
    }
    const targetType = duplicateKeepType ? duplicateSource.bomType : duplicateBomType;
    const targetModel = duplicateModelName.trim();
    if (!isGlobalBomType(targetType) && !targetModel) {
      setDuplicateWarning(bomUi.duplicateMissing);
      return;
    }
    setIsDuplicating(true);
    setDuplicateWarning(null);
    const params = new URLSearchParams();
    params.set("bomType", targetType);
    if (!isGlobalBomType(targetType)) {
      params.set("modelName", targetModel);
    }
    try {
      const check = await fetch(`/api/bom?${params.toString()}`, { cache: "no-store" });
      if (check.ok) {
        const existing = await check.json();
        if (existing?.bom?.items?.length && !duplicateNeedsOverwrite) {
          setDuplicateWarning(bomUi.duplicateExists);
          setDuplicateNeedsOverwrite(true);
          setIsDuplicating(false);
          return;
        }
      }
      const response = await fetch("/api/bom", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelName: isGlobalBomType(targetType) ? "" : targetModel,
          bomType: targetType,
          items: duplicateSource.items.map((item) => ({
            partId: item.partId,
            qtyPerPlow: item.qtyPerPlow,
          })),
        }),
      });
      if (!response.ok) {
        setDuplicateWarning(t.error);
        setIsDuplicating(false);
        return;
      }

      if (targetType === "STANDARD") {
        setStandardModel(targetModel || standardModel);
        loadBomByType(targetType, targetModel || standardModel)
          .then(setStandardItems)
          .catch(() => null);
      } else if (targetType === "ADDON_6_2") {
        setAddonModel(targetModel || addonModel);
        loadBomByType(targetType, targetModel || addonModel)
          .then(setAddonItems)
          .catch(() => null);
      } else {
        setSchwenkType(targetType);
        loadBomByType(targetType, "")
          .then(setSchwenkItems)
          .catch(() => null);
      }
      setNotice({ type: "success", message: t.saved });
      setDuplicateSource(null);
    } catch {
      setDuplicateWarning(t.error);
    } finally {
      setIsDuplicating(false);
    }
  };

  const addBomItem = async (
    event: FormEvent<HTMLFormElement>,
    partQuery: string,
    qty: number,
    items: BomItem[],
    setItems: (items: BomItem[]) => void,
    setQuery: (value: string) => void,
    setQty: (value: number) => void,
    bomType: BomType,
    modelName: string,
    setSaving: (value: boolean) => void,
    isSaving: boolean
  ) => {
    event.preventDefault();
    const partName = partQuery.trim().toLowerCase();
    const part = bomPartOptions.find(
      (option) => option.name.toLowerCase() === partName
    );
    if (!part || !Number.isInteger(qty) || qty <= 0) {
      setNotice({ type: "error", message: t.error });
      return;
    }
    await addBomItemByPart(
      part,
      qty,
      items,
      setItems,
      bomType,
      modelName,
      setSaving,
      isSaving
    );
    setQuery("");
    setQty(1);
  };

  const addBomItemByPart = async (
    part: PartPickerPart,
    qty: number,
    items: BomItem[],
    setItems: (items: BomItem[]) => void,
    bomType: BomType,
    modelName: string,
    setSaving: (value: boolean) => void,
    isSaving: boolean
  ) => {
    if (isSaving) {
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0) {
      setNotice({ type: "error", message: t.error });
      return;
    }
    const baseItems = [
      ...items.filter((item) => item.partId !== part.id),
      {
        partId: part.id,
        qtyPerPlow: qty,
        part: { name: part.name, category: part.category ?? null },
      },
    ];

    const relations = buildAutoRelations(bomPartOptions, part.name);
    let nextItems = baseItems;
    if (relations.length > 0) {
      const list = relations
        .map((relation) => `${relation.part.name} x${relation.qty * qty}`)
        .join(", ");
      const confirmed = window.confirm(`${t.partsAutoAddConfirm}\n${t.partsAutoAddListLabel}: ${list}`);
      if (confirmed) {
        nextItems = baseItems.map((item) => ({ ...item }));
        relations.forEach((relation) => {
          const existing = nextItems.find((item) => item.partId === relation.part.id);
          if (existing) {
            existing.qtyPerPlow += relation.qty * qty;
          } else {
            nextItems.push({
              partId: relation.part.id,
              qtyPerPlow: relation.qty * qty,
              part: { name: relation.part.name, category: relation.part.category ?? null },
            });
          }
        });
      }
    }
    await saveBomItems(bomType, modelName, nextItems, setItems, setSaving, isSaving);
  };

  const handlePickerAdd = async (part: PartPickerPart, qty: number) => {
    if (pickerTarget === "STANDARD") {
      await addBomItemByPart(
        part,
        qty,
        standardItems,
        setStandardItems,
        "STANDARD",
        standardModel,
        setIsSavingStandard,
        isSavingStandard
      );
      setStandardPartQuery(part.name);
      setStandardQty(qty);
    } else if (pickerTarget === "ADDON_6_2") {
      await addBomItemByPart(
        part,
        qty,
        addonItems,
        setAddonItems,
        "ADDON_6_2",
        addonModel,
        setIsSavingAddon,
        isSavingAddon
      );
      setAddonPartQuery(part.name);
      setAddonQty(qty);
    } else {
      await addBomItemByPart(
        part,
        qty,
        schwenkItems,
        setSchwenkItems,
        pickerTarget,
        "",
        setIsSavingSchwenk,
        isSavingSchwenk
      );
      setSchwenkPartQuery(part.name);
      setSchwenkQty(qty);
    }
    setNotice({ type: "success", message: t.saved });
    setIsPartPickerOpen(false);
  };

  const removeBomItem = async (
    partId: number,
    items: BomItem[],
    setItems: (items: BomItem[]) => void,
    bomType: BomType,
    modelName: string,
    setSaving: (value: boolean) => void,
    isSaving: boolean
  ) => {
    const nextItems = items.filter((item) => item.partId !== partId);
    await saveBomItems(bomType, modelName, nextItems, setItems, setSaving, isSaving);
  };

  const handleNewPartChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setNewPart((prev) => ({
      ...prev,
      [name]: name === "stock" ? Number(value) : value,
    }));
  };

  const handleCreatePart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const response = await fetch("/api/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPart.name,
        stock: newPart.stock,
        unit: newPart.unit,
        category: newPart.category,
        shopUrl: newPart.shopUrl,
        shopName: newPart.shopName,
      }),
    });
    if (!response.ok) {
      setNotice({ type: "error", message: t.error });
      return;
    }
    setNotice({ type: "success", message: t.saved });
    setNewPart({ name: "", stock: 0, unit: "szt", category: "", shopUrl: "", shopName: "" });
    await loadParts(partsPage, partsFilters.query, partsFilters.categories, partsFilters.sort);
  };

  const handleEditPart = (part: Part) => {
    setEditPart(part);
    setEditPartForm({
      name: part.name ?? "",
      unit: part.unit ?? "",
      category: part.category ?? "inne",
      shopUrl: part.shopUrl ?? "",
      shopName: part.shopName ?? "",
      stockAbsolute: "",
    });
  };

  const handleEditPartChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setEditPartForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSavePart = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editPart) {
      return;
    }
    const payload = {
      name: editPartForm.name,
      unit: editPartForm.unit,
      category: editPartForm.category,
      shopUrl: editPartForm.shopUrl,
      shopName: editPartForm.shopName,
    };
    const response = await fetch(`/api/parts/${editPart.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setNotice({ type: "error", message: t.error });
      return;
    }
    const updated: Part = await response.json();
    setParts((prev) => prev.map((part) => (part.id === updated.id ? updated : part)));
    setEditPart(null);
    setNotice({ type: "success", message: t.saved });
  };

  const handleSetAbsoluteStock = async () => {
    if (!editPart) {
      return;
    }
    if (String(editPartForm.stockAbsolute).trim() === "") {
      setNotice({ type: "error", message: t.error });
      return;
    }
    const nextStock = Number(editPartForm.stockAbsolute);
    if (!Number.isInteger(nextStock)) {
      setNotice({ type: "error", message: t.error });
      return;
    }
    const response = await fetch(`/api/parts/${editPart.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stockAbsolute: nextStock }),
    });
    if (!response.ok) {
      setNotice({ type: "error", message: t.error });
      return;
    }
    const updated: Part = await response.json();
    setParts((prev) => prev.map((part) => (part.id === updated.id ? updated : part)));
    setEditPart(updated);
    setEditPartForm((prev) => ({ ...prev, stockAbsolute: "" }));
    setNotice({ type: "success", message: t.saved });
  };

  const handleAdjustChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setAdjustForm((prev) => ({
      ...prev,
      [name]: name === "delta" ? value : value,
    }));
  };

  const handleAdjustSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adjustTarget) {
      return;
    }
    const deltaValue = Number(adjustForm.delta);
    if (!Number.isInteger(deltaValue) || deltaValue === 0) {
      setNotice({ type: "error", message: t.error + t.partsAdjustQty });
      return;
    }
    const response = await fetch("/api/parts/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partId: adjustTarget.id,
        delta: deltaValue,
        note: adjustForm.note,
      }),
    });
    if (!response.ok) {
      setNotice({ type: "error", message: t.error });
      return;
    }
    const updated: Part = await response.json();
    setParts((prev) => prev.map((part) => (part.id === updated.id ? updated : part)));
    setAdjustTarget(null);
    setAdjustForm({ delta: "", note: "" });
    setNotice({ type: "success", message: t.saved });
  };

  const handleArchivePart = async (part: Part) => {
    const confirmMessage = t.partsDeleteConfirm ?? "Usunac czesc?";
    if (!window.confirm(confirmMessage)) {
      return;
    }
    const response = await fetch(`/api/parts/${part.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message =
        body?.message === "PART_IN_USE"
          ? t.partsDeleteBlocked
          : t.error;
      setNotice({ type: "error", message });
      return;
    }
    setParts((prev) => prev.filter((item) => item.id !== part.id));
    setPartsTotalCount((prev) => Math.max(0, prev - 1));
    setNotice({ type: "success", message: t.saved });
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);
    setImportResult(null);
    setImportError(null);
    setImportPreviewError(null);
    setImportPreview([]);
    setImportSkipped([]);
    setManualSkipped([]);
    if (!file) {
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setImportPreviewError(t.partsImportNoSheet);
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      const preview = buildImportPreview(rows);
      if (preview.nameIndex < 0 || preview.qtyIndex < 0) {
        setImportPreviewError(t.partsImportHeaderMissing);
        return;
      }
      const items = preview.items.map((item, index) => ({
        ...item,
        id: `${index}-${item.name}`,
      }));
      setImportPreview(items);
      setImportSkipped(preview.skipped);
    } catch {
      setImportPreviewError(t.error);
    }
  };

  const handleImportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isImporting) {
      return;
    }
    if (importPreview.length === 0) {
      setImportError(t.partsImportHeaderMissing);
      return;
    }
    setIsImporting(true);
    setImportError(null);
    setImportResult(null);
    const response = await fetch("/api/parts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: importPreview.map((item) => ({
          name: item.name,
          stock: item.stock,
          category: item.category,
        })),
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.message ? String(body.message) : await response.text();
      setImportError(message || t.error);
      setIsImporting(false);
      return;
    }
    const data: ImportResult = await response.json();
    setImportResult(data);
    setIsImporting(false);
    try {
      await loadParts(partsPage, partsFilters.query, partsFilters.categories, partsFilters.sort);
    } catch {
      setNotice({ type: "error", message: t.error });
    }
  };

  const handlePreviewChange = (
    id: string,
    field: "name" | "stock" | "category",
    value: string
  ) => {
    setImportPreview((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }
        if (field === "stock") {
          const parsed = Number(value);
          return { ...item, stock: Number.isFinite(parsed) ? Math.round(parsed) : item.stock };
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handlePreviewRemove = (id: string) => {
    setImportPreview((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        setManualSkipped((prevSkipped) => [
          ...prevSkipped,
          { reason: "manual_remove", name: target.name },
        ]);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const closeImportModal = () => {
    setIsImportOpen(false);
    setImportFile(null);
    setImportResult(null);
    setImportError(null);
    setImportPreviewError(null);
    setImportPreview([]);
    setImportSkipped([]);
    setManualSkipped([]);
    setIsImporting(false);
  };

  const loadMovements = async (page: number, filters: typeof movementFilters) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per", String(PAGE_SIZE));
    if (filters.reason) {
      params.set("reason", filters.reason);
    }
    if (filters.shipmentId) {
      params.set("shipmentId", filters.shipmentId);
    }
    if (filters.from) {
      params.set("from", filters.from);
    }
    if (filters.to) {
      params.set("to", filters.to);
    }
    const response = await fetch(`/api/parts/movements?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: MovementsResponse = await response.json();
    setMovements(data.items);
    setMovementsPage(data.page);
    setMovementsTotalPages(data.totalPages);
  };

  useEffect(() => {
    if (tab !== "movements") {
      return;
    }
    loadMovements(1, movementFilters).catch(() => {
      setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
    });
  }, [tab, movementFilters]);

  const handleMovementFilterChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setMovementFilterInput((prev) => ({ ...prev, [name]: value }));
  };

  const applyMovementFilters = () => {
    setMovementFilters(movementFilterInput);
  };

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin";
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/parts");
  };

  return (
    <div className="app-shell">
      <div className="app-content">
        <header className="card">
          <div className="card-header">
            <div>
              <h1 className="title title-with-icon">{t.adminTitle}</h1>
              <p className="subtitle">{t.adminSubtitle}</p>
            </div>
            <div className="admin-actions">
              <button className="button button-ghost" type="button" onClick={handleBack}>
                {t.adminBack}
              </button>
              <button className="button button-ghost" type="button" onClick={handleLogout}>
                {t.adminLogout}
              </button>
              <div className="lang-toggle">
                <span className="pill">{t.languageToggle}</span>
                <div className="lang-buttons">
                  <button
                    type="button"
                    className={`lang-btn ${lang === "pl" ? "active" : ""}`}
                    onClick={() => setLang("pl")}
                  >
                    PL
                  </button>
                  <button
                    type="button"
                    className={`lang-btn ${lang === "de" ? "active" : ""}`}
                    onClick={() => setLang("de")}
                  >
                    DE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {notice && <div className={`alert ${notice.type === "success" ? "success" : ""}`}>{notice.message}</div>}

        <div className="tabs admin-tabs">
          <button
            type="button"
            className={`tab-link ${tab === "bom" ? "tab-active" : ""}`}
            onClick={() => setTab("bom")}
          >
            {t.adminTabBom}
          </button>
          <button
            type="button"
            className={`tab-link ${tab === "parts" ? "tab-active" : ""}`}
            onClick={() => setTab("parts")}
          >
            {t.adminTabParts}
          </button>
          <button
            type="button"
            className={`tab-link ${tab === "movements" ? "tab-active" : ""}`}
            onClick={() => setTab("movements")}
          >
            {t.adminTabMovements}
          </button>
        </div>

        {tab === "bom" && (
          <section className="card admin-section">
            <div className="card-header">
              <div>
                <h2 className="title">{t.adminTabBom}</h2>
                <p className="subtitle">{t.bomConfigLabel}</p>
              </div>
            </div>

            <div className="bom-section">
              <div className="card-header">
                <div>
                  <h3 className="title">{t.standard}</h3>
                  <p className="subtitle">{t.bomModelLabel}</p>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() =>
                      copyBomToClipboard("STANDARD", standardModel, standardItems)
                    }
                  >
                    {bomUi.copy}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() =>
                      openDuplicateModal("STANDARD", standardModel, standardItems)
                    }
                  >
                    {bomUi.duplicate}
                  </button>
                </div>
              </div>
              <div className="form-row">
                <label>
                  {t.bomModelLabel}
                  <select
                    value={standardModel}
                    onChange={(event) => setStandardModel(event.target.value)}
                  >
                    {models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <form
                className="form form-compact"
                onSubmit={(event) =>
                  addBomItem(
                    event,
                    standardPartQuery,
                    standardQty,
                    standardItems,
                    setStandardItems,
                    setStandardPartQuery,
                    setStandardQty,
                    "STANDARD",
                    standardModel,
                    setIsSavingStandard,
                    isSavingStandard
                  )
                }
              >
                <div className="form-row">
                  <label className="form-grow">
                    {t.bomPartLabel}
                    <input
                      list="bom-parts"
                      value={standardPartQuery}
                      onChange={(event) => setStandardPartQuery(event.target.value)}
                      placeholder={t.partsSearch}
                    />
                    <datalist id="bom-parts">
                      {bomPartOptions.map((part) => (
                        <option key={part.id} value={part.name} />
                      ))}
                    </datalist>
                  </label>
                  <div className="form-actions form-actions-tight">
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => {
                        setPickerTarget("STANDARD");
                        setIsPartPickerOpen(true);
                      }}
                    >
                      {t.partsPick}
                    </button>
                  </div>
                  <label>
                    {t.bomQtyLabel}
                    <input
                      type="number"
                      value={standardQty}
                      onChange={(event) => setStandardQty(Number(event.target.value))}
                      min={1}
                      step="1"
                    />
                  </label>
                  <div className="form-actions form-actions-tight">
                    <button type="submit" className="button" disabled={isSavingStandard}>
                      {t.bomAddItem}
                    </button>
                  </div>
                </div>
              </form>

              <div className="table-wrap">
                <table className="inventory-table compact-table">
                  <thead>
                    <tr>
                      <th>{t.bomPartLabel}</th>
                      <th>{t.bomQtyLabel}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {renderGroupedBomRows(
                      standardItems,
                      setStandardItems,
                      "STANDARD",
                      standardModel,
                      setIsSavingStandard,
                      isSavingStandard
                    )}
                  </tbody>
                </table>
              </div>

              <div className="form" style={{ marginTop: 16 }}>
                <label>
                  {bomUi.jsonLabel}
                  <textarea
                    value={standardJson}
                    onChange={(event) => {
                      setStandardJson(event.target.value);
                      setStandardJsonError(null);
                    }}
                    placeholder={bomUi.jsonPlaceholder}
                    rows={5}
                  />
                </label>
                {standardJsonError && <div className="alert">{standardJsonError}</div>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() =>
                      applyBomJson(
                        standardJson,
                        setStandardItems,
                        setStandardJsonError,
                        standardItems
                      )
                    }
                  >
                    {bomUi.paste}
                  </button>
                </div>
              </div>
            </div>

            <div className="bom-section">
              <div className="card-header">
                <div>
                  <h3 className="title">6/2</h3>
                  <p className="subtitle">{t.bomModelLabel}</p>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() =>
                      copyBomToClipboard("ADDON_6_2", addonModel, addonItems)
                    }
                  >
                    {bomUi.copy}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() =>
                      openDuplicateModal("ADDON_6_2", addonModel, addonItems)
                    }
                  >
                    {bomUi.duplicate}
                  </button>
                </div>
              </div>
              <div className="form-row">
                <label>
                  {t.bomModelLabel}
                  <select
                    value={addonModel}
                    onChange={(event) => setAddonModel(event.target.value)}
                  >
                    {models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <form
                className="form form-compact"
                onSubmit={(event) =>
                  addBomItem(
                    event,
                    addonPartQuery,
                    addonQty,
                    addonItems,
                    setAddonItems,
                    setAddonPartQuery,
                    setAddonQty,
                    "ADDON_6_2",
                    addonModel,
                    setIsSavingAddon,
                    isSavingAddon
                  )
                }
              >
                <div className="form-row">
                  <label className="form-grow">
                    {t.bomPartLabel}
                    <input
                      list="bom-parts"
                      value={addonPartQuery}
                      onChange={(event) => setAddonPartQuery(event.target.value)}
                      placeholder={t.partsSearch}
                    />
                  </label>
                  <div className="form-actions form-actions-tight">
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => {
                        setPickerTarget("ADDON_6_2");
                        setIsPartPickerOpen(true);
                      }}
                    >
                      {t.partsPick}
                    </button>
                  </div>
                  <label>
                    {t.bomQtyLabel}
                    <input
                      type="number"
                      value={addonQty}
                      onChange={(event) => setAddonQty(Number(event.target.value))}
                      min={1}
                      step="1"
                    />
                  </label>
                  <div className="form-actions form-actions-tight">
                    <button type="submit" className="button" disabled={isSavingAddon}>
                      {t.bomAddItem}
                    </button>
                  </div>
                </div>
              </form>

              <div className="table-wrap">
                <table className="inventory-table compact-table">
                  <thead>
                    <tr>
                      <th>{t.bomPartLabel}</th>
                      <th>{t.bomQtyLabel}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {renderGroupedBomRows(
                      addonItems,
                      setAddonItems,
                      "ADDON_6_2",
                      addonModel,
                      setIsSavingAddon,
                      isSavingAddon
                    )}
                  </tbody>
                </table>
              </div>

              <div className="form" style={{ marginTop: 16 }}>
                <label>
                  {bomUi.jsonLabel}
                  <textarea
                    value={addonJson}
                    onChange={(event) => {
                      setAddonJson(event.target.value);
                      setAddonJsonError(null);
                    }}
                    placeholder={bomUi.jsonPlaceholder}
                    rows={5}
                  />
                </label>
                {addonJsonError && <div className="alert">{addonJsonError}</div>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() =>
                      applyBomJson(
                        addonJson,
                        setAddonItems,
                        setAddonJsonError,
                        addonItems
                      )
                    }
                  >
                    {bomUi.paste}
                  </button>
                </div>
              </div>
            </div>

            <div className="bom-section">
              <div className="card-header">
                <div>
                  <h3 className="title">{t.schwenkbock}</h3>
                  <p className="subtitle">{t.bomConfigLabel}</p>
                </div>
                <div className="card-actions">
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() => copyBomToClipboard(schwenkType, "", schwenkItems)}
                  >
                    {bomUi.copy}
                  </button>
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() => openDuplicateModal(schwenkType, "", schwenkItems)}
                  >
                    {bomUi.duplicate}
                  </button>
                </div>
              </div>
              <div className="form-row">
                <label>
                  {t.bomConfigLabel}
                  <select
                    value={schwenkType}
                    onChange={(event) => setSchwenkType(event.target.value as BomType)}
                  >
                    {schwenkOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <form
                className="form form-compact"
                onSubmit={(event) =>
                  addBomItem(
                    event,
                    schwenkPartQuery,
                    schwenkQty,
                    schwenkItems,
                    setSchwenkItems,
                    setSchwenkPartQuery,
                    setSchwenkQty,
                    schwenkType,
                    "GLOBAL",
                    setIsSavingSchwenk,
                    isSavingSchwenk
                  )
                }
              >
                <div className="form-row">
                  <label className="form-grow">
                    {t.bomPartLabel}
                    <input
                      list="bom-parts"
                      value={schwenkPartQuery}
                      onChange={(event) => setSchwenkPartQuery(event.target.value)}
                      placeholder={t.partsSearch}
                    />
                  </label>
                  <div className="form-actions form-actions-tight">
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => {
                        setPickerTarget(schwenkType);
                        setIsPartPickerOpen(true);
                      }}
                    >
                      {t.partsPick}
                    </button>
                  </div>
                  <label>
                    {t.bomQtyLabel}
                    <input
                      type="number"
                      value={schwenkQty}
                      onChange={(event) => setSchwenkQty(Number(event.target.value))}
                      min={1}
                      step="1"
                    />
                  </label>
                  <div className="form-actions form-actions-tight">
                    <button type="submit" className="button" disabled={isSavingSchwenk}>
                      {t.bomAddItem}
                    </button>
                  </div>
                </div>
              </form>

              <div className="table-wrap">
                <table className="inventory-table compact-table">
                  <thead>
                    <tr>
                      <th>{t.bomPartLabel}</th>
                      <th>{t.bomQtyLabel}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {renderGroupedBomRows(
                      schwenkItems,
                      setSchwenkItems,
                      schwenkType,
                      "GLOBAL",
                      setIsSavingSchwenk,
                      isSavingSchwenk
                    )}
                  </tbody>
                </table>
              </div>

              <div className="form" style={{ marginTop: 16 }}>
                <label>
                  {bomUi.jsonLabel}
                  <textarea
                    value={schwenkJson}
                    onChange={(event) => {
                      setSchwenkJson(event.target.value);
                      setSchwenkJsonError(null);
                    }}
                    placeholder={bomUi.jsonPlaceholder}
                    rows={5}
                  />
                </label>
                {schwenkJsonError && <div className="alert">{schwenkJsonError}</div>}
                <div className="form-actions">
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() =>
                      applyBomJson(
                        schwenkJson,
                        setSchwenkItems,
                        setSchwenkJsonError,
                        schwenkItems
                      )
                    }
                  >
                    {bomUi.paste}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "parts" && (
          <section className="card admin-section">
            <div className="card-header">
              <div>
                <h2 className="title">{t.adminTabParts}</h2>
                <p className="subtitle">{t.partsPageSubtitle}</p>
              </div>
              <div className="card-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    setIsImportOpen(true);
                    setImportResult(null);
                    setImportError(null);
                    setImportFile(null);
                    setImportPreviewError(null);
                    setImportPreview([]);
                    setImportSkipped([]);
                    setManualSkipped([]);
                  }}
                >
                  {t.partsImportButton}
                </button>
              </div>
            </div>

            <form className="form form-compact" onSubmit={handleCreatePart}>
              <div className="form-row">
                <label className="form-grow">
                  {t.partsAddTitle}
                  <input
                    name="name"
                    value={newPart.name}
                    onChange={handleNewPartChange}
                    placeholder={t.bomPartLabel}
                    required
                  />
                </label>
                <label>
                  {t.partsStock}
                  <input
                    type="number"
                    name="stock"
                    value={newPart.stock}
                    onChange={handleNewPartChange}
                    step="1"
                  />
                </label>
                <label>
                  {t.partsUnit}
                  <input
                    name="unit"
                    value={newPart.unit}
                    onChange={handleNewPartChange}
                    placeholder="szt"
                  />
                </label>
                <label>
                  {t.partsCategory}
                  <select
                    name="category"
                    value={newPart.category}
                    onChange={handleNewPartChange}
                  >
                    <option value="sruby">{t.categorySruby}</option>
                    <option value="nakretki">{t.categoryNakretki}</option>
                    <option value="podkladki">{t.categoryPodkladki}</option>
                    <option value="bolce">{t.categoryBolce}</option>
                    <option value="hydraulika">{t.categoryHydraulika}</option>
                    <option value="cylindry">{t.categoryCylindry}</option>
                    <option value="weze">{t.categoryWeze}</option>
                    <option value="gumy">{t.categoryGumy}</option>
                    <option value="elektryka">{t.categoryElektryka}</option>
                    <option value="inne">{t.categoryInne}</option>
                  </select>
                </label>
                <label className="form-grow">
                  {t.shopUrlLabel}
                  <input
                    name="shopUrl"
                    value={newPart.shopUrl}
                    onChange={handleNewPartChange}
                    placeholder="https://"
                  />
                </label>
                <label className="form-grow">
                  {t.shopNameLabel}
                  <input
                    name="shopName"
                    value={newPart.shopName}
                    onChange={handleNewPartChange}
                  />
                </label>
                <div className="form-actions form-actions-tight">
                  <button type="submit" className="button">
                    {t.partsAddButton}
                  </button>
                </div>
              </div>
            </form>

            <div className="admin-parts-toolbar">
              <PartsToolbar
                queryInput={partsFilters.queryInput}
                onQueryChange={partsFilters.setQueryInput}
                sort={partsFilters.sort}
                onSortChange={partsFilters.setSort}
                categoryOptions={buildCategoryOptions(partsCategories, lang)}
                activeCategories={partsFilters.categories}
                onCategoriesChange={partsFilters.setCategories}
                labels={{
                  partsSearch: t.partsSearch,
                  partsSortLabel: t.partsSortLabel,
                  partsSortName: t.partsSortName,
                  partsSortStockAsc: t.partsSortStockAsc,
                  partsSortStockDesc: t.partsSortStockDesc,
                  partsCategoryAll: t.partsCategoryAll,
                  partsCategoryLabel: t.partsCategoryLabel,
                }}
              />
            </div>

            <PartsTable
              parts={parts.map((part) => ({
                ...part,
                category: translateCategory(part.category, lang) || part.category,
              }))}
              labels={{
                partsTitle: t.partsTitle,
                partsStock: t.partsStock,
                partsCategory: t.partsCategory,
                partsCategoryUnknown: t.partsCategoryUnknown,
                shopNameLabel: t.shopNameLabel,
                shopUrlLabel: t.shopUrlLabel,
                partsEmpty: t.partsEmpty,
                partsLoading: t.partsLoading,
                partsAdjust: t.partsAdjust,
                partsEdit: t.partsEdit,
                partsDelete: t.partsDelete,
                actionsLabel: t.actionsLabel,
                copyName: t.copyName,
                resultsLabel: t.resultsLabel,
                groupFasteners: `${t.categorySruby} / ${t.categoryPodkladki} / ${t.categoryNakretki}`,
                groupElectric: t.categoryElektryka,
                groupParts: lang === "pl" ? "Czesci" : "Teile",
                groupHydraulics: t.categoryHydraulika,
                groupOther: t.categoryInne,
              }}
              mode="admin"
              resultsCount={partsTotalCount}
              isLoading={isPartsLoading}
              onAdjust={(part) => setAdjustTarget(part)}
              onEdit={handleEditPart}
              onDelete={handleArchivePart}
            />

            <div className="pagination">
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() =>
                  loadParts(partsPage - 1, partsFilters.query, partsFilters.categories, partsFilters.sort)
                }
                disabled={partsPage <= 1}
              >
                &lsaquo;
              </button>
              <span className="pill">
                {partsPage} / {partsTotalPages}
              </span>
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() =>
                  loadParts(partsPage + 1, partsFilters.query, partsFilters.categories, partsFilters.sort)
                }
                disabled={partsPage >= partsTotalPages}
              >
                &rsaquo;
              </button>
            </div>
          </section>
        )}

        {tab === "movements" && (
          <section className="card admin-section">
            <div className="card-header">
              <div>
                <h2 className="title">{t.movementTitle}</h2>
                <p className="subtitle">{t.adminTabMovements}</p>
              </div>
            </div>

            <div className="filter-row">
              <select
                name="reason"
                value={movementFilterInput.reason}
                onChange={handleMovementFilterChange}
              >
                <option value="">{t.movementReason}</option>
                <option value="READY_SHIPMENT">READY</option>
                <option value="ROLLBACK_SHIPMENT">ROLLBACK</option>
                <option value="MANUAL_ADJUST">MANUAL</option>
              </select>
              <input
                name="shipmentId"
                value={movementFilterInput.shipmentId}
                onChange={handleMovementFilterChange}
                placeholder={t.movementShipmentId}
              />
              <input
                type="date"
                name="from"
                value={movementFilterInput.from}
                onChange={handleMovementFilterChange}
              />
              <input
                type="date"
                name="to"
                value={movementFilterInput.to}
                onChange={handleMovementFilterChange}
              />
              <button type="button" className="button button-ghost" onClick={applyMovementFilters}>
                {t.movementFilter}
              </button>
            </div>

            <div className="table-wrap">
              <table className="inventory-table compact-table">
                <thead>
                  <tr>
                    <th>{t.bomPartLabel}</th>
                    <th>{t.quantity}</th>
                    <th>{t.movementReason}</th>
                    <th>{t.movementShipmentId}</th>
                    <th>{t.movementFrom}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movement.part.name}</td>
                      <td>{movement.delta}</td>
                      <td>{movement.reason}</td>
                      <td>{movement.shipmentId ?? "-"}</td>
                      <td>{new Date(movement.createdAt).toISOString().slice(0, 16).replace("T", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => loadMovements(movementsPage - 1, movementFilters)}
                disabled={movementsPage <= 1}
              >
                &lsaquo;
              </button>
              <span className="pill">
                {movementsPage} / {movementsTotalPages}
              </span>
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => loadMovements(movementsPage + 1, movementFilters)}
                disabled={movementsPage >= movementsTotalPages}
              >
                &rsaquo;
              </button>
            </div>
          </section>
        )}
      </div>

      {isImportOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <section className="card modal-card">
            <div className="card-header">
              <div>
                <h3 className="title">{t.partsImportTitle}</h3>
                <p className="subtitle">{t.partsImportSubtitle}</p>
              </div>
              <div className="card-actions">
                <button type="button" className="button button-ghost" onClick={closeImportModal}>
                  {t.partsImportClose}
                </button>
              </div>
            </div>

            <p className="muted">{t.partsImportHint}</p>

            <form className="form" onSubmit={handleImportSubmit}>
              <label>
                {t.partsImportFileLabel}
                <input type="file" accept=".xlsx,.xls" onChange={handleImportFileChange} />
              </label>
              {importFile && <div className="muted">{importFile.name}</div>}
              {importPreview.length > 0 && (
                <div className="badge-stack">
                  <span className="pill">
                    {t.partsImportReady}: {importPreview.length}
                  </span>
                  <span className="pill">
                    {t.partsImportSkipped}: {previewSummary.counts.missing_name +
                      previewSummary.counts.missing_qty +
                      previewSummary.counts.model_fl +
                      previewSummary.counts.orange +
                      previewSummary.counts.edge_protection +
                      previewSummary.counts.sticker +
                      previewSummary.counts.chemistry +
                      previewSummary.counts.manual_remove +
                      previewSummary.counts.invalid_row}
                  </span>
                </div>
              )}
              {importPreview.length > 0 && (
                <div className="table-wrap import-preview-table">
                  <table className="inventory-table compact-table">
                    <thead>
                      <tr>
                        <th>{t.partsTitle}</th>
                        <th>{t.partsStock}</th>
                        <th>{t.partsCategory}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <input
                              value={item.name}
                              onChange={(event) =>
                                handlePreviewChange(item.id, "name", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              value={item.stock}
                              onChange={(event) =>
                                handlePreviewChange(item.id, "stock", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={item.category}
                              onChange={(event) =>
                                handlePreviewChange(item.id, "category", event.target.value)
                              }
                            />
                          </td>
                          <td className="parts-actions-cell">
                            <button
                              type="button"
                              className="button button-ghost button-small"
                              onClick={() => handlePreviewRemove(item.id)}
                            >
                              {t.delete}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {importPreview.length > 0 && (
                <div className="import-reasons">
                  <p className="muted">{t.partsImportReasonTitle}</p>
                  <div className="badge-stack">
                    {(
                      Object.keys(previewSummary.counts) as ImportSkipReason[]
                    ).filter((reason) => previewSummary.counts[reason] > 0).map((reason) => (
                      <span key={reason} className="pill">
                        {importReasonLabels[reason]}: {previewSummary.counts[reason]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-actions">
                <button
                  type="submit"
                  className="button"
                  disabled={importPreview.length === 0 || isImporting}
                >
                  {isImporting ? t.partsImportLoading : t.partsImportStart}
                </button>
                <button type="button" className="button button-ghost" onClick={closeImportModal}>
                  {t.cancel}
                </button>
              </div>
            </form>

            {importPreviewError && <div className="alert">{importPreviewError}</div>}
            {importError && <div className="alert">{importError}</div>}
          </section>
        </div>
      )}

      {importResult && (
        <div className="success-overlay" role="dialog" aria-modal="true">
          <section className="card reserve-success-card import-result-card">
            <div className="card-header">
              <div>
                <h3 className="title">{t.partsImportSuccess}</h3>
                <p className="subtitle">{t.partsImportSubtitle}</p>
              </div>
            </div>
            <div className="badge-stack">
              <span className="pill">
                {t.partsImportCreated}: {importResult.createdCount}
              </span>
              <span className="pill">
                {t.partsImportUpdated}: {importResult.updatedCount}
              </span>
              <span className="pill">
                {t.partsImportSkipped}: {importResult.skippedCount}
              </span>
            </div>
            <div className="import-reasons">
              <p className="muted">{t.partsImportReasonTitle}</p>
              <div className="badge-stack">
                {(Object.keys(importResult.skippedReasonCounts) as ImportSkipReason[])
                  .filter((reason) => importResult.skippedReasonCounts[reason] > 0)
                  .map((reason) => (
                    <span key={reason} className="pill">
                      {importReasonLabels[reason]}: {importResult.skippedReasonCounts[reason]}
                    </span>
                  ))}
              </div>
            </div>
            {importResult.createdExamples.length > 0 && (
              <div>
                <p className="muted">
                  {t.partsImportCreated} {t.partsImportExamples}
                </p>
                <p>{importResult.createdExamples.join(", ")}</p>
              </div>
            )}
            {importResult.updatedExamples.length > 0 && (
              <div>
                <p className="muted">
                  {t.partsImportUpdated} {t.partsImportExamples}
                </p>
                <p>{importResult.updatedExamples.join(", ")}</p>
              </div>
            )}
            {importResult.skippedExamples.length > 0 && (
              <div>
                <p className="muted">
                  {t.partsImportSkipped} {t.partsImportExamples}
                </p>
                <p>{importResult.skippedExamples.join(", ")}</p>
              </div>
            )}
            <div className="confirm-actions">
              <button
                type="button"
                className="button"
                onClick={() => {
                  setImportResult(null);
                  closeImportModal();
                }}
              >
                OK
              </button>
            </div>
          </section>
        </div>
      )}

      {isPartPickerOpen && (
        <PartPickerModal
          isOpen={isPartPickerOpen}
          onClose={() => setIsPartPickerOpen(false)}
          onAdd={handlePickerAdd}
          lang={lang}
          labels={{
            title: t.partsPickerTitle,
            search: t.partsSearch,
            categoryAll: t.partsCategoryAll,
            categoryLabel: t.partsCategoryLabel,
            sortLabel: t.partsSortLabel,
            sortName: t.partsSortName,
            sortStockAsc: t.partsSortStockAsc,
            sortStockDesc: t.partsSortStockDesc,
            addLabel: t.partsPickerAdd,
            closeLabel: t.partsPickerClose,
            emptyLabel: t.partsEmpty,
          }}
        />
      )}

      {editPart && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <section className="card modal-card">
            <div className="card-header">
              <div>
                <h3 className="title title-with-icon">{editPart.name}</h3>
                <p className="subtitle">{t.partsEdit}</p>
              </div>
            </div>
            <form className="form" onSubmit={handleSavePart}>
              <label>
                {t.bomPartLabel}
                <input
                  name="name"
                  value={editPartForm.name}
                  onChange={handleEditPartChange}
                />
              </label>
              <label>
                {t.partsUnit}
                <input
                  name="unit"
                  value={editPartForm.unit}
                  onChange={handleEditPartChange}
                />
              </label>
              <label>
                {t.partsCategory}
                <select
                  name="category"
                  value={editPartForm.category}
                  onChange={handleEditPartChange}
                >
                  <option value="sruby">{t.categorySruby}</option>
                  <option value="nakretki">{t.categoryNakretki}</option>
                  <option value="podkladki">{t.categoryPodkladki}</option>
                  <option value="bolce">{t.categoryBolce}</option>
                  <option value="hydraulika">{t.categoryHydraulika}</option>
                  <option value="cylindry">{t.categoryCylindry}</option>
                  <option value="weze">{t.categoryWeze}</option>
                  <option value="gumy">{t.categoryGumy}</option>
                  <option value="elektryka">{t.categoryElektryka}</option>
                  <option value="inne">{t.categoryInne}</option>
                </select>
              </label>
              <label>
                {t.shopUrlLabel}
                <input
                  name="shopUrl"
                  value={editPartForm.shopUrl}
                  onChange={handleEditPartChange}
                />
              </label>
              <label>
                {t.shopNameLabel}
                <input
                  name="shopName"
                  value={editPartForm.shopName}
                  onChange={handleEditPartChange}
                />
              </label>
              <label>
                {t.partsSetStock}
                <input
                  name="stockAbsolute"
                  type="number"
                  value={editPartForm.stockAbsolute}
                  onChange={handleEditPartChange}
                  placeholder={String(editPart.stock)}
                />
              </label>
              <div className="form-actions">
                <button type="submit" className="button">
                  {t.saved}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={handleSetAbsoluteStock}
                >
                  {t.partsSetStock}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setEditPart(null)}
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {duplicateSource && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <section className="card modal-card">
            <div className="card-header">
              <div>
                <h3 className="title">{bomUi.duplicateTitle}</h3>
                <p className="subtitle">
                  {getNormalizedModelName(duplicateSource.bomType, duplicateSource.modelName)} ·{" "}
                  {getBomTypeLabel(duplicateSource.bomType)}
                </p>
              </div>
            </div>
            <div className="form">
              <label>
                {bomUi.duplicateModelLabel}
                <input
                  value={duplicateModelName}
                  onChange={(event) => {
                    setDuplicateModelName(event.target.value);
                    setDuplicateWarning(null);
                    setDuplicateNeedsOverwrite(false);
                  }}
                  placeholder="FL 540"
                  disabled={isGlobalBomType(
                    duplicateKeepType ? duplicateSource.bomType : duplicateBomType
                  )}
                />
              </label>
              <label>
                {bomUi.duplicateTypeLabel}
                <select
                  value={duplicateKeepType ? duplicateSource.bomType : duplicateBomType}
                  onChange={(event) => {
                    setDuplicateBomType(event.target.value as BomType);
                    setDuplicateKeepType(false);
                    setDuplicateWarning(null);
                    setDuplicateNeedsOverwrite(false);
                  }}
                  disabled={duplicateKeepType}
                >
                  {bomTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={duplicateKeepType}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setDuplicateKeepType(checked);
                    if (checked) {
                      setDuplicateBomType(duplicateSource.bomType);
                    }
                    setDuplicateWarning(null);
                    setDuplicateNeedsOverwrite(false);
                  }}
                />
                {bomUi.duplicateKeepType}
              </label>
              {duplicateWarning && <div className="alert">{duplicateWarning}</div>}
              <div className="form-actions">
                <button
                  type="button"
                  className="button"
                  onClick={confirmDuplicate}
                  disabled={isDuplicating}
                >
                  {duplicateNeedsOverwrite ? bomUi.duplicateOverwrite : bomUi.duplicateCreate}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setDuplicateSource(null)}
                  disabled={isDuplicating}
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {adjustTarget && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <section className="card modal-card">
            <div className="card-header">
              <div>
                <h3 className="title title-with-icon">{t.partsAdjust}</h3>
                <p className="subtitle">{adjustTarget.name}</p>
              </div>
            </div>
            <form className="form" onSubmit={handleAdjustSubmit}>
              <label>
                {t.partsAdjustQty}
                <input
                  type="number"
                  name="delta"
                  value={adjustForm.delta}
                  onChange={handleAdjustChange}
                  step="1"
                />
              </label>
              <label>
                {t.partsAdjustNote}
                <textarea
                  name="note"
                  value={adjustForm.note}
                  onChange={handleAdjustChange}
                />
              </label>
              <div className="form-actions">
                <button type="submit" className="button">
                  {t.partsAdjustSave}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setAdjustTarget(null)}
                >
                  {t.partsAdjustCancel}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
