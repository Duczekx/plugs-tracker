"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { labels, Lang } from "@/lib/i18n";

type Part = {
  id: number;
  name: string;
  stock: number;
  unit: string;
  shopUrl?: string | null;
  shopName?: string | null;
};

type BomItem = {
  partId: number;
  qtyPerPlow: number;
  part?: { name: string };
};

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
const configurations = [
  { value: "STANDARD", label: "Standard" },
  { value: "STANDARD_6_2", label: "Standard + 6/2" },
  { value: "SCHWENKBOCK", label: "Schwenkbock" },
  { value: "SCHWENKBOCK_6_2", label: "Schwenkbock + 6/2" },
];

const PAGE_SIZE = 50;

export default function AdminPanel() {
  const [lang, setLang] = useState<Lang>("pl");
  const [tab, setTab] = useState<"bom" | "parts" | "movements">("bom");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const [modelName, setModelName] = useState(models[0]);
  const [configuration, setConfiguration] = useState(configurations[0].value);
  const [bomItems, setBomItems] = useState<BomItem[]>([]);
  const [bomPartQuery, setBomPartQuery] = useState("");
  const [bomPartOptions, setBomPartOptions] = useState<Part[]>([]);
  const [bomQty, setBomQty] = useState(1);
  const [isSavingBom, setIsSavingBom] = useState(false);

  const [parts, setParts] = useState<Part[]>([]);
  const [partsPage, setPartsPage] = useState(1);
  const [partsTotalPages, setPartsTotalPages] = useState(1);
  const [partsQuery, setPartsQuery] = useState("");
  const [partsQueryInput, setPartsQueryInput] = useState("");
  const [newPart, setNewPart] = useState({
    name: "",
    stock: 0,
    shopUrl: "",
    shopName: "",
  });
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [editPartForm, setEditPartForm] = useState({ shopUrl: "", shopName: "" });

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


  const loadBom = async () => {
    const params = new URLSearchParams({
      modelName,
      configuration,
    });
    const response = await fetch(`/api/bom?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data = await response.json();
    setBomItems(data.bom?.items ?? []);
  };

  useEffect(() => {
    loadBom().catch(() => {
      setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
    });
  }, [modelName, configuration]);

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
    loadPartOptions(bomPartQuery).catch(() => null);
  }, [bomPartQuery]);

  const saveBomItems = async (nextItems: BomItem[]) => {
    if (isSavingBom) {
      return;
    }
    setIsSavingBom(true);
    const response = await fetch("/api/bom", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelName,
        configuration,
        items: nextItems.map((item) => ({
          partId: item.partId,
          qtyPerPlow: item.qtyPerPlow,
        })),
      }),
    });
    if (!response.ok) {
      setNotice({ type: "error", message: t.error });
      setIsSavingBom(false);
      return;
    }
    const data = await response.json();
    setBomItems(data.bom?.items ?? []);
    setNotice({ type: "success", message: t.saved });
    setIsSavingBom(false);
  };

  const handleAddBomItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const partName = bomPartQuery.trim().toLowerCase();
    const part = bomPartOptions.find(
      (option) => option.name.toLowerCase() === partName
    );
    if (!part || !Number.isInteger(bomQty) || bomQty <= 0) {
      setNotice({ type: "error", message: t.error });
      return;
    }
    const nextItems = [
      ...bomItems.filter((item) => item.partId !== part.id),
      { partId: part.id, qtyPerPlow: bomQty, part: { name: part.name } },
    ];
    await saveBomItems(nextItems);
    setBomPartQuery("");
    setBomQty(1);
  };

  const handleRemoveBomItem = async (partId: number) => {
    const nextItems = bomItems.filter((item) => item.partId !== partId);
    await saveBomItems(nextItems);
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
        shopUrl: newPart.shopUrl,
        shopName: newPart.shopName,
      }),
    });
    if (!response.ok) {
      setNotice({ type: "error", message: t.error });
      return;
    }
    setNotice({ type: "success", message: t.saved });
    setNewPart({ name: "", stock: 0, shopUrl: "", shopName: "" });
    await loadParts(partsPage, partsQuery);
  };

  const handleEditPart = (part: Part) => {
    setEditPart(part);
    setEditPartForm({
      shopUrl: part.shopUrl ?? "",
      shopName: part.shopName ?? "",
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
    const response = await fetch(`/api/parts/${editPart.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopUrl: editPartForm.shopUrl,
        shopName: editPartForm.shopName,
      }),
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
            <div className="form-row">
              <label>
                {t.bomModelLabel}
                <select value={modelName} onChange={(event) => setModelName(event.target.value)}>
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.bomConfigLabel}
                <select
                  value={configuration}
                  onChange={(event) => setConfiguration(event.target.value)}
                >
                  {configurations.map((config) => (
                    <option key={config.value} value={config.value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <form className="form form-compact" onSubmit={handleAddBomItem}>
              <div className="form-row">
                <label className="form-grow">
                  {t.bomPartLabel}
                  <input
                    list="bom-parts"
                    value={bomPartQuery}
                    onChange={(event) => setBomPartQuery(event.target.value)}
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
                    value={bomQty}
                    onChange={(event) => setBomQty(Number(event.target.value))}
                    min={1}
                    step="1"
                  />
                </label>
                <div className="form-actions form-actions-tight">
                  <button type="submit" className="button" disabled={isSavingBom}>
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
                  {bomItems.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        {t.bomEmpty}
                      </td>
                    </tr>
                  )}
                  {bomItems.map((item) => (
                    <tr key={item.partId}>
                      <td>{item.part?.name ?? item.partId}</td>
                      <td>{item.qtyPerPlow}</td>
                      <td>
                        <button
                          type="button"
                          className="button button-ghost button-small"
                          onClick={() => handleRemoveBomItem(item.partId)}
                        >
                          {t.delete}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

            <div className="filter-row parts-search">
              <input
                value={partsQueryInput}
                onChange={(event) => setPartsQueryInput(event.target.value)}
                placeholder={t.partsSearch}
              />
            </div>

            <div className="table-wrap">
              <table className="inventory-table compact-table">
                <thead>
                  <tr>
                    <th>{t.partsTitle}</th>
                    <th>{t.partsStock}</th>
                    <th>{t.partsUnit}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {parts.map((part) => (
                    <tr key={part.id}>
                      <td>{part.name}</td>
                      <td>{part.stock}</td>
                      <td>{part.unit}</td>
                      <td>
                        <button
                          type="button"
                          className="button button-ghost button-small"
                          onClick={() => handleEditPart(part)}
                        >
                          {t.editItem}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                type="button"
                className="button button-ghost button-small"
                onClick={() => loadParts(partsPage - 1, partsQuery)}
                disabled={partsPage <= 1}
              >
                ‹
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
                ›
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
                ‹
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
                ›
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
                <p className="subtitle">{t.partsAdjust}</p>
              </div>
            </div>
            <form className="form" onSubmit={handleSavePart}>
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
              <div className="form-actions">
                <button type="submit" className="button">
                  {t.saved}
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
    </div>
  );
}
