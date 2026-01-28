"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { labels, Lang } from "@/lib/i18n";
import PartsTable from "@/components/PartsTable";

type Part = {
  id: number;
  name: string;
  stock: number;
  unit: string;
  shopUrl?: string | null;
  shopName?: string | null;
  isArchived?: boolean;
};

type BomItem = {
  partId: number;
  qtyPerPlow: number;
  part?: { name: string };
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

const models = ["FL 640", "FL 540", "FL 470", "FL 400", "FL 340", "FL 260"];
const schwenkOptions: { value: BomType; label: string }[] = [
  { value: "SCHWENKBOCK_3000", label: "Schwenkbock 3000" },
  { value: "SCHWENKBOCK_2000", label: "Schwenkbock 2000" },
];

const PAGE_SIZE = 50;

export default function AdminPanel() {
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

  const [parts, setParts] = useState<Part[]>([]);
  const [partsPage, setPartsPage] = useState(1);
  const [partsTotalPages, setPartsTotalPages] = useState(1);
  const [partsTotalCount, setPartsTotalCount] = useState(0);
  const [partsQuery, setPartsQuery] = useState("");
  const [partsQueryInput, setPartsQueryInput] = useState("");
  const [newPart, setNewPart] = useState({
    name: "",
    stock: 0,
    unit: "szt",
    shopUrl: "",
    shopName: "",
  });
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [editPartForm, setEditPartForm] = useState({
    name: "",
    unit: "",
    shopUrl: "",
    shopName: "",
    stockAbsolute: "",
  });
  const [adjustTarget, setAdjustTarget] = useState<Part | null>(null);
  const [adjustForm, setAdjustForm] = useState({ delta: 0, note: "" });

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

  useEffect(() => {
    const handle = setTimeout(() => setPartsQuery(partsQueryInput), 400);
    return () => clearTimeout(handle);
  }, [partsQueryInput]);

  const loadParts = async (page: number, query: string) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per", String(PAGE_SIZE));
    if (query) {
      params.set("q", query);
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
  };

  useEffect(() => {
    if (tab !== "parts") {
      return;
    }
    loadParts(1, partsQuery).catch(() => {
      setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
    });
  }, [tab, partsQuery]);

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
    const nextItems = [
      ...items.filter((item) => item.partId !== part.id),
      { partId: part.id, qtyPerPlow: qty, part: { name: part.name } },
    ];
    await saveBomItems(bomType, modelName, nextItems, setItems, setSaving, isSaving);
    setQuery("");
    setQty(1);
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

  const handleNewPartChange = (event: ChangeEvent<HTMLInputElement>) => {
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
        shopUrl: newPart.shopUrl,
        shopName: newPart.shopName,
      }),
    });
    if (!response.ok) {
      setNotice({ type: "error", message: t.error });
      return;
    }
    setNotice({ type: "success", message: t.saved });
    setNewPart({ name: "", stock: 0, unit: "szt", shopUrl: "", shopName: "" });
    await loadParts(partsPage, partsQuery);
  };

  const handleEditPart = (part: Part) => {
    setEditPart(part);
    setEditPartForm({
      name: part.name ?? "",
      unit: part.unit ?? "",
      shopUrl: part.shopUrl ?? "",
      shopName: part.shopName ?? "",
      stockAbsolute: "",
    });
  };

  const handleEditPartChange = (event: ChangeEvent<HTMLInputElement>) => {
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
      [name]: name === "delta" ? Number(value) : value,
    }));
  };

  const handleAdjustSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adjustTarget) {
      return;
    }
    if (!Number.isInteger(adjustForm.delta) || adjustForm.delta === 0) {
      setNotice({ type: "error", message: t.error + t.partsAdjustQty });
      return;
    }
    const response = await fetch("/api/parts/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partId: adjustTarget.id,
        delta: adjustForm.delta,
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
    setAdjustForm({ delta: 0, note: "" });
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
                    {standardItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          {t.bomEmpty}
                        </td>
                      </tr>
                    )}
                    {standardItems.map((item) => (
                      <tr key={item.partId}>
                        <td>{item.part?.name ?? item.partId}</td>
                        <td>{item.qtyPerPlow}</td>
                        <td>
                          <button
                            type="button"
                            className="button button-ghost button-small"
                            onClick={() =>
                              removeBomItem(
                                item.partId,
                                standardItems,
                                setStandardItems,
                                "STANDARD",
                                standardModel,
                                setIsSavingStandard,
                                isSavingStandard
                              )
                            }
                          >
                            {t.delete}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bom-section">
              <div className="card-header">
                <div>
                  <h3 className="title">6/2</h3>
                  <p className="subtitle">{t.bomModelLabel}</p>
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
                    {addonItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          {t.bomEmpty}
                        </td>
                      </tr>
                    )}
                    {addonItems.map((item) => (
                      <tr key={item.partId}>
                        <td>{item.part?.name ?? item.partId}</td>
                        <td>{item.qtyPerPlow}</td>
                        <td>
                          <button
                            type="button"
                            className="button button-ghost button-small"
                            onClick={() =>
                              removeBomItem(
                                item.partId,
                                addonItems,
                                setAddonItems,
                                "ADDON_6_2",
                                addonModel,
                                setIsSavingAddon,
                                isSavingAddon
                              )
                            }
                          >
                            {t.delete}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bom-section">
              <div className="card-header">
                <div>
                  <h3 className="title">{t.schwenkbock}</h3>
                  <p className="subtitle">{t.bomConfigLabel}</p>
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
                    {schwenkItems.length === 0 && (
                      <tr>
                        <td colSpan={3} className="muted">
                          {t.bomEmpty}
                        </td>
                      </tr>
                    )}
                    {schwenkItems.map((item) => (
                      <tr key={item.partId}>
                        <td>{item.part?.name ?? item.partId}</td>
                        <td>{item.qtyPerPlow}</td>
                        <td>
                          <button
                            type="button"
                            className="button button-ghost button-small"
                            onClick={() =>
                              removeBomItem(
                                item.partId,
                                schwenkItems,
                                setSchwenkItems,
                                schwenkType,
                                "GLOBAL",
                                setIsSavingSchwenk,
                                isSavingSchwenk
                              )
                            }
                          >
                            {t.delete}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

            <div className="parts-search-bar">
              <input
                value={partsQueryInput}
                onChange={(event) => setPartsQueryInput(event.target.value)}
                placeholder={t.partsSearch}
              />
            <span className="pill">
              {t.resultsLabel}: {partsTotalCount}
            </span>
            </div>

            <PartsTable
              parts={parts}
              labels={{
                partsTitle: t.partsTitle,
                partsStock: t.partsStock,
                partsUnit: t.partsUnit,
                shopNameLabel: t.shopNameLabel,
                shopUrlLabel: t.shopUrlLabel,
                partsEmpty: t.partsEmpty,
                partsAdjust: t.partsAdjust,
                partsEdit: t.partsEdit,
                partsDelete: t.partsDelete,
                actionsLabel: t.actionsLabel,
                copyName: t.copyName,
              }}
              mode="admin"
              onAdjust={(part) => setAdjustTarget(part)}
              onEdit={handleEditPart}
              onDelete={handleArchivePart}
            />

            <div className="pagination">
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => loadParts(partsPage - 1, partsQuery)}
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
                onClick={() => loadParts(partsPage + 1, partsQuery)}
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
