"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { labels, Lang } from "@/lib/i18n";

type Variant = "ZINC" | "ORANGE";
type Model = "FL_640" | "FL_540" | "FL_470" | "FL_400" | "FL_340" | "FL_260";

type InventoryItem = {
  id: number;
  model: Model;
  serialNumber: number;
  variant: Variant;
  isSchwenkbock: boolean;
  quantity: number;
  isManual: boolean;
  updatedAt: string;
};

type Product = {
  model: Model;
  serialNumber: number;
  isManual?: boolean;
};

type ProductForm = {
  model: Model;
  serialNumber: string;
};

const variants: Variant[] = ["ZINC", "ORANGE"];
const models: Model[] = ["FL_640", "FL_540", "FL_470", "FL_400", "FL_340", "FL_260"];

const emptyProductForm: ProductForm = {
  model: "FL_540",
  serialNumber: "",
};

const suggestedNumbers: Record<Model, number[]> = {
  FL_640: [2901],
  FL_540: [2716],
  FL_470: [2404],
  FL_400: [1801],
  FL_340: [1403],
  FL_260: [1203],
};

export default function Home() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("plugs-tracker-lang");
      if (stored === "pl" || stored === "de") {
        return stored;
      }
    }
    return "pl";
  });
  const pathname = usePathname();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [adjustModel, setAdjustModel] = useState<Model>("FL_540");
  const [adjustSerialNumber, setAdjustSerialNumber] = useState<string>("");
  const [adjustVariant, setAdjustVariant] = useState<Variant>("ZINC");
  const [adjustSchwenkbock, setAdjustSchwenkbock] = useState(false);
  const [adjustDelta, setAdjustDelta] = useState<string>("");
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [inventoryFilter, setInventoryFilter] = useState({
    model: "ALL",
    serialNumber: "",
    variant: "ALL",
    schwenkbock: "ALL",
  });
  const [inventoryView, setInventoryView] = useState<"cards" | "list">("cards");
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    window.localStorage.setItem("plugs-tracker-lang", lang);
  }, [lang]);

  const t = labels[lang];

  const variantLabel = useMemo(
    () => ({
      ZINC: t.variantZinc,
      ORANGE: t.variantOrange,
    }),
    [t]
  );

  const modelLabel = useMemo(() => t.models, [t]);

  const groupedInventory = useMemo(() => {
    const map: Record<
      string,
      {
        model: Model;
        serialNumber: number;
        isManual?: boolean;
        standard: Record<Variant, number>;
        schwenkbock: Record<Variant, number>;
      }
    > = {};

    inventory.forEach((item) => {
      const key = `${item.model}-${item.serialNumber}`;
      if (!map[key]) {
        map[key] = {
          model: item.model,
          serialNumber: item.serialNumber,
          isManual: item.isManual,
          standard: { ZINC: 0, ORANGE: 0 },
          schwenkbock: { ZINC: 0, ORANGE: 0 },
        };
      }
      const bucket = item.isSchwenkbock ? "schwenkbock" : "standard";
      map[key][bucket][item.variant] = item.quantity;
    });

    return Object.values(map).sort((a, b) => {
      if (a.model === b.model) {
        return a.serialNumber - b.serialNumber;
      }
      return a.model.localeCompare(b.model);
    });
  }, [inventory]);

  const inventorySummary = useMemo(() => {
    const summary = {
      standard: { ZINC: 0, ORANGE: 0 },
      schwenk: { ZINC: 0, ORANGE: 0 },
      all: { ZINC: 0, ORANGE: 0 },
    };
    inventory.forEach((item) => {
      if (item.isSchwenkbock) {
        summary.schwenk[item.variant] += item.quantity;
      } else {
        summary.standard[item.variant] += item.quantity;
      }
      summary.all[item.variant] += item.quantity;
    });
    return summary;
  }, [inventory]);

  const productNumbersByModel = useMemo(() => {
    const map: Record<Model, number[]> = {
      FL_640: [],
      FL_540: [],
      FL_470: [],
      FL_400: [],
      FL_340: [],
      FL_260: [],
    };
    products.forEach((product) => {
      map[product.model].push(product.serialNumber);
    });
    Object.values(map).forEach((numbers) => numbers.sort((a, b) => a - b));
    return map;
  }, [products]);

  const filteredInventory = useMemo(() => {
    return groupedInventory.filter((product) => {
      if (
        inventoryFilter.model !== "ALL" &&
        product.model !== inventoryFilter.model
      ) {
        return false;
      }
      if (inventoryFilter.serialNumber) {
        const serial = Number(inventoryFilter.serialNumber);
        if (!Number.isNaN(serial) && product.serialNumber !== serial) {
          return false;
        }
      }
      const bucket =
        inventoryFilter.schwenkbock === "SCHWENK"
          ? product.schwenkbock
          : inventoryFilter.schwenkbock === "STANDARD"
          ? product.standard
          : null;
      if (inventoryFilter.variant !== "ALL") {
        const variant = inventoryFilter.variant as Variant;
        if (bucket) {
          return bucket[variant] > 0;
        }
        return (
          product.standard[variant] > 0 || product.schwenkbock[variant] > 0
        );
      }
      return true;
    });
  }, [groupedInventory, inventoryFilter]);

  const loadInventory = async () => {
    const response = await fetch("/api/inventory");
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: InventoryItem[] = await response.json();
    setInventory(data);
  };

  const loadProducts = async () => {
    const response = await fetch("/api/products");
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: Product[] = await response.json();
    setProducts(data);
    if (data.length > 0) {
      const hasCurrentAdjust = data.some((item) => item.model === adjustModel);
      if (!hasCurrentAdjust) {
        setAdjustModel(data[0].model);
      }
      if (!adjustSerialNumber) {
        setAdjustSerialNumber(String(data[0].serialNumber));
      }
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadInventory(), loadProducts()]);
  };

  useEffect(() => {
    refreshAll().catch(() => {
      setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
    });
  }, []);

  useEffect(() => {
    const serials = productNumbersByModel[adjustModel];
    if (serials.length > 0) {
      setAdjustSerialNumber(String(serials[0]));
    } else {
      setAdjustSerialNumber("");
    }
  }, [adjustModel, productNumbersByModel]);

  const handleAdjust = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      setNotice({
        type: "error",
        message: t.adjustHint,
      });
      return;
    }

    const response = await fetch("/api/inventory/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: adjustModel,
        serialNumber: Number(adjustSerialNumber),
        variant: adjustVariant,
        isSchwenkbock: adjustSchwenkbock,
        delta,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.message ? `${t.error}${body.message}` : t.error;
      setNotice({ type: "error", message });
      return;
    }

    setAdjustDelta("");
    await loadInventory();
    setNotice({ type: "success", message: t.saved });
  };

  const currentStock = useMemo(() => {
    const match = inventory.find(
      (item) =>
        item.model === adjustModel &&
        item.serialNumber === Number(adjustSerialNumber) &&
        item.variant === adjustVariant &&
        item.isSchwenkbock === adjustSchwenkbock
    );
    return match?.quantity ?? 0;
  }, [
    inventory,
    adjustModel,
    adjustSerialNumber,
    adjustVariant,
    adjustSchwenkbock,
  ]);

  const adjustDeltaBy = (step: number) => {
    const next = Number(adjustDelta || 0) + step;
    setAdjustDelta(String(next));
  };

  const handleProductChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = event.target;
    setProductForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    const serialNumber = Number(productForm.serialNumber);

    if (!Number.isInteger(serialNumber) || serialNumber <= 0) {
      setNotice({ type: "error", message: t.error + t.serialNumber });
      return;
    }

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: productForm.model,
        serialNumber,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.message ? `${t.error}${body.message}` : t.error;
      setNotice({ type: "error", message });
      return;
    }

    setProductForm(emptyProductForm);
    await refreshAll();
    setNotice({ type: "success", message: t.saved });
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(t.confirmDelete)) {
      return;
    }
    const response = await fetch("/api/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.message ? `${t.error}${body.message}` : t.error;
      setNotice({ type: "error", message });
      return;
    }
    await refreshAll();
    setNotice({ type: "success", message: t.saved });
  };

  return (
    <div className="app-shell">
      <div className="app-content">
        <header className="card">
          <div className="card-header">
            <div>
              <h1 className="title title-with-icon">
                <span className="title-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M4 6.5h6.2l1.4 2.2H20a1 1 0 0 1 1 1v7.1a1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1z"
                      fill="currentColor"
                      opacity="0.16"
                    />
                    <path
                      d="M4 6.5h6.2l1.4 2.2H20a1 1 0 0 1 1 1v7.1a1 1 0 0 1-1 1H4.8a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </span>
                {t.appTitle}
              </h1>
              <p className="subtitle">{t.appSubtitle}</p>
            </div>
            <div />
          </div>
        </header>
        <div className="sticky-nav">
          <div className="sticky-nav-inner">
            <div />
            <div className="tabs">
              <Link
                className={`tab-link ${pathname === "/" ? "tab-active" : ""}`}
                href="/"
              >
                {t.inventoryTab}
              </Link>
              <Link
                className={`tab-link ${
                  pathname === "/shipments" ? "tab-active" : ""
                }`}
                href="/shipments"
              >
                {t.shipmentsTab}
              </Link>
              <Link
                className={`tab-link ${pathname === "/sent" ? "tab-active" : ""}`}
                href="/sent"
              >
                {t.sentTab}
              </Link>
            </div>
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

        {notice && (
          <div className={`alert ${notice.type === "success" ? "success" : ""}`}>
            {notice.message}
          </div>
        )}

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="title title-with-icon">
                <span className="title-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M12 4v16M4 12h16"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.08" />
                  </svg>
                </span>
                {t.addProductTitle}
              </h2>
              <p className="subtitle">{t.addProductHint}</p>
            </div>
          </div>
          <form className="form" onSubmit={handleProductSubmit}>
            <div className="form-row">
              <label>
                {t.modelLabel}
                <select
                  name="model"
                  value={productForm.model}
                  onChange={handleProductChange}
                >
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {modelLabel[model]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.serialNumber}
                <input
                  name="serialNumber"
                  value={productForm.serialNumber}
                  onChange={handleProductChange}
                  placeholder="2716"
                  list={`serial-${productForm.model}`}
                />
                <datalist id={`serial-${productForm.model}`}>
                  {suggestedNumbers[productForm.model].map((serial) => (
                    <option key={serial} value={serial} />
                  ))}
                </datalist>
              </label>
            </div>
            <div className="form-actions">
              <button className="button" type="submit">
                <svg
                  className="button-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                {t.addProduct}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="title title-with-icon">
                <span className="title-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M4 9.5 12 5l8 4.5-8 4.5-8-4.5z"
                      fill="currentColor"
                      opacity="0.14"
                    />
                    <path
                      d="M4 9.5 12 5l8 4.5-8 4.5-8-4.5zM4 14.5l8 4.5 8-4.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {t.inventoryTitle}
              </h2>
              <p className="subtitle">{t.inventorySubtitle}</p>
            </div>
            <div className="badge-stack">
              <span className="pill">{t.quantity}</span>
              <span className="badge-glow">
                {inventorySummary.all.ZINC + inventorySummary.all.ORANGE}
              </span>
            </div>
          </div>
          <div className="view-toggle">
            <button
              type="button"
              className={`view-btn ${inventoryView === "cards" ? "active" : ""}`}
              onClick={() => setInventoryView("cards")}
            >
              Kafelki
            </button>
            <button
              type="button"
              className={`view-btn ${inventoryView === "list" ? "active" : ""}`}
              onClick={() => setInventoryView("list")}
            >
              Lista
            </button>
          </div>
          <div className="filter-row">
            <span className="pill">{t.filters}</span>
            <select
              value={inventoryFilter.model}
              onChange={(event) =>
                setInventoryFilter((prev) => ({
                  ...prev,
                  model: event.target.value,
                }))
              }
            >
              <option value="ALL">{t.all}</option>
              {models.map((model) => (
                <option key={model} value={model}>
                  {modelLabel[model]}
                </option>
              ))}
            </select>
            <input
              value={inventoryFilter.serialNumber}
              onChange={(event) =>
                setInventoryFilter((prev) => ({
                  ...prev,
                  serialNumber: event.target.value,
                }))
              }
              placeholder={t.serialNumber}
            />
            <select
              value={inventoryFilter.variant}
              onChange={(event) =>
                setInventoryFilter((prev) => ({
                  ...prev,
                  variant: event.target.value,
                }))
              }
            >
              <option value="ALL">{t.all}</option>
              <option value="ZINC">{variantLabel.ZINC}</option>
              <option value="ORANGE">{variantLabel.ORANGE}</option>
            </select>
            <select
              value={inventoryFilter.schwenkbock}
              onChange={(event) =>
                setInventoryFilter((prev) => ({
                  ...prev,
                  schwenkbock: event.target.value,
                }))
              }
            >
              <option value="ALL">{t.all}</option>
              <option value="STANDARD">{t.standard}</option>
              <option value="SCHWENK">{t.schwenkbock}</option>
            </select>
          </div>
          {inventoryView === "cards" ? (
            <div
              className={`grid grid-2 inventory-grid ${
                filteredInventory.length === 1 ? "inventory-grid-single" : ""
              }`}
              style={{ marginTop: 20 }}
            >
              {filteredInventory.length === 0 && <p>{t.inventoryEmpty}</p>}
              {filteredInventory.map((product) => (
                <div
                  key={`${product.model}-${product.serialNumber}`}
                  className="inventory-card"
                >
                  <div className="inventory-title">
                    <span className="inventory-heading">
                      {modelLabel[product.model]} {product.serialNumber}
                      <span className="inventory-divider" aria-hidden="true" />
                    </span>
                    {product.isManual && (
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() =>
                          handleDeleteProduct({
                            model: product.model,
                            serialNumber: product.serialNumber,
                          })
                        }
                      >
                        <svg
                          className="button-icon"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            d="M5 7h14M9 7V5h6v2M9 11v6M15 11v6"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {t.delete}
                      </button>
                    )}
                  </div>
                  <div className="inventory-stack">
                    <div className="inventory-group">
                      <div className="inventory-group-title">
                        <span className="group-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M4 7h16M4 12h16M4 17h16"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                        {t.standard}
                      </div>
                      {variants.map((variant) => (
                        <div key={`standard-${variant}`} className="variant-block">
                          <div className="variant-label">
                            <span
                              className={`variant-dot ${
                                variant === "ZINC" ? "dot-zinc" : "dot-orange"
                              }`}
                              aria-hidden="true"
                            />
                            {variantLabel[variant]}
                          </div>
                          <div
                            className={`variant-value ${
                              variant === "ZINC"
                                ? "variant-zinc"
                                : "variant-orange"
                            } ${
                              product.standard[variant] === 0
                                ? "variant-zero"
                                : ""
                            }`}
                          >
                            {product.standard[variant]}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="inventory-group">
                      <div className="inventory-group-title">
                        <span className="group-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M12 4v16M4 12h16"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            />
                            <path
                              d="M16 8l4 4-4 4"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                        {t.schwenkbock}
                      </div>
                      {variants.map((variant) => (
                        <div key={`schwenk-${variant}`} className="variant-block">
                          <div className="variant-label">
                            <span
                              className={`variant-dot ${
                                variant === "ZINC" ? "dot-zinc" : "dot-orange"
                              }`}
                              aria-hidden="true"
                            />
                            {variantLabel[variant]}
                          </div>
                          <div
                            className={`variant-value ${
                              variant === "ZINC"
                                ? "variant-zinc"
                                : "variant-orange"
                            } ${
                              product.schwenkbock[variant] === 0
                                ? "variant-zero"
                                : ""
                            }`}
                          >
                            {product.schwenkbock[variant]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="inventory-list">
              {filteredInventory.length === 0 ? (
                <p>{t.inventoryEmpty}</p>
              ) : (
                filteredInventory.map((product) => {
                  const total =
                    product.standard.ZINC +
                    product.standard.ORANGE +
                    product.schwenkbock.ZINC +
                    product.schwenkbock.ORANGE;
                  return (
                    <div
                      key={`${product.model}-${product.serialNumber}`}
                      className="inventory-list-item"
                    >
                      <div className="inventory-list-head">
                        <div className="inventory-list-main">
                          <div className="inventory-list-title">
                            {modelLabel[product.model]} {product.serialNumber}
                          </div>
                          <div className="inventory-list-meta">
                            <span className="pill">{t.totalAll}</span>
                            <span className="badge-glow">{total}</span>
                          </div>
                        </div>
                        {product.isManual && (
                          <div className="inventory-list-actions">
                            <button
                              type="button"
                              className="button button-ghost button-small"
                              onClick={() =>
                                handleDeleteProduct({
                                  model: product.model,
                                  serialNumber: product.serialNumber,
                                })
                              }
                            >
                              <svg
                                className="button-icon"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path
                                  d="M5 7h14M9 7V5h6v2M9 11v6M15 11v6"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              {t.delete}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="inventory-list-body">
                        <div className="inventory-list-group">
                          <div className="inventory-list-group-title">
                            <span className="group-icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24">
                                <path
                                  d="M4 7h16M4 12h16M4 17h16"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </span>
                            {t.standard}
                          </div>
                          <div className="inventory-list-variants">
                            {variants.map((variant) => (
                              <div
                                key={`list-standard-${variant}`}
                                className="variant-block"
                              >
                                <div className="variant-label">
                                  <span
                                    className={`variant-dot ${
                                      variant === "ZINC"
                                        ? "dot-zinc"
                                        : "dot-orange"
                                    }`}
                                    aria-hidden="true"
                                  />
                                  {variantLabel[variant]}
                                </div>
                                <div
                                  className={`variant-value ${
                                    variant === "ZINC"
                                      ? "variant-zinc"
                                      : "variant-orange"
                                  } ${
                                    product.standard[variant] === 0
                                      ? "variant-zero"
                                      : ""
                                  }`}
                                >
                                  {product.standard[variant]}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="inventory-list-group">
                          <div className="inventory-list-group-title">
                            <span className="group-icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24">
                                <path
                                  d="M12 4v16M4 12h16"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M16 8l4 4-4 4"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                            {t.schwenkbock}
                          </div>
                          <div className="inventory-list-variants">
                            {variants.map((variant) => (
                              <div
                                key={`list-schwenk-${variant}`}
                                className="variant-block"
                              >
                                <div className="variant-label">
                                  <span
                                    className={`variant-dot ${
                                      variant === "ZINC"
                                        ? "dot-zinc"
                                        : "dot-orange"
                                    }`}
                                    aria-hidden="true"
                                  />
                                  {variantLabel[variant]}
                                </div>
                                <div
                                  className={`variant-value ${
                                    variant === "ZINC"
                                      ? "variant-zinc"
                                      : "variant-orange"
                                  } ${
                                    product.schwenkbock[variant] === 0
                                      ? "variant-zero"
                                      : ""
                                  }`}
                                >
                                  {product.schwenkbock[variant]}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="title title-with-icon">
                <span className="title-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M6 7h12M6 12h6M6 17h10"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M16.5 12.5 19 10l2.5 2.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M19 10v6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                {t.adjustTitle}
              </h2>
              <p className="subtitle">{t.adjustHint}</p>
            </div>
            <div className="stock-mini">
              <span className="stock-label">{t.stockNow}</span>
              <span className="stock-value">{currentStock}</span>
            </div>
          </div>
          <form className="form" onSubmit={handleAdjust}>
            <div className="adjust-grid">
              <div className="form">
                <div className="form-row">
                  <label>
                    {t.modelLabel}
                    <select
                      value={adjustModel}
                      onChange={(event) =>
                        setAdjustModel(event.target.value as Model)
                      }
                    >
                      {models.map((model) => (
                        <option key={model} value={model}>
                          {modelLabel[model]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t.serialNumber}
                    <select
                      value={adjustSerialNumber}
                      onChange={(event) =>
                        setAdjustSerialNumber(event.target.value)
                      }
                    >
                      {productNumbersByModel[adjustModel].map((serial) => (
                        <option key={serial} value={serial}>
                          {serial}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="variant-toggle">
                  <button
                    type="button"
                    className={`variant-choice ${
                      adjustVariant === "ZINC" ? "active" : ""
                    }`}
                    onClick={() => setAdjustVariant("ZINC")}
                  >
                    <span className="variant-dot dot-zinc" />
                    {variantLabel.ZINC}
                  </button>
                  <button
                    type="button"
                    className={`variant-choice ${
                      adjustVariant === "ORANGE" ? "active" : ""
                    }`}
                    onClick={() => setAdjustVariant("ORANGE")}
                  >
                    <span className="variant-dot dot-orange" />
                    {variantLabel.ORANGE}
                  </button>
                  <label className="switch">
                    <span>{t.schwenkbock}</span>
                    <input
                      type="checkbox"
                      checked={adjustSchwenkbock}
                      onChange={(event) =>
                        setAdjustSchwenkbock(event.target.checked)
                      }
                    />
                  </label>
                </div>
                <div className="stepper">
                  <button type="button" onClick={() => adjustDeltaBy(-1)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 12h12"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <div className="delta-chip">
                    <span>{t.changeLabel}</span>
                    <strong>{adjustDelta || "0"}</strong>
                  </div>
                  <button type="button" onClick={() => adjustDeltaBy(1)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 6v12M6 12h12"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="form-actions">
              <button className="button" type="submit">
                <svg
                  className="button-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M6 12l4 4 8-8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t.addButton}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
