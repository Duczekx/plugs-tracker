"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { labels, Lang } from "@/lib/i18n";

type Variant = "ZINC" | "ORANGE";
type Model = "FL_640" | "FL_540" | "FL_470" | "FL_400" | "FL_340" | "FL_260";
type ValveType = "NONE" | "SMALL" | "LARGE";

type ShipmentItemDraft = {
  model: Model;
  serialNumber: number;
  variant: Variant;
  isSchwenkbock: boolean;
  quantity: number;
  buildNumber: string;
  buildDate: string;
  bucketHolder: boolean;
  valveType: ValveType;
  extraParts: string;
};

type CustomerForm = {
  companyName: string;
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  notes: string;
};

type Product = {
  model: Model;
  serialNumber: number;
};

const models: Model[] = ["FL_640", "FL_540", "FL_470", "FL_400", "FL_340", "FL_260"];
const valveTypes: ValveType[] = ["NONE", "SMALL", "LARGE"];

const createEmptyItemForm = (): ShipmentItemDraft => ({
  model: "FL_540",
  serialNumber: 0,
  variant: "ZINC",
  isSchwenkbock: false,
  quantity: 1,
  buildNumber: "",
  buildDate: new Date().toISOString().slice(0, 10),
  bucketHolder: false,
  valveType: "NONE",
  extraParts: "",
});

const emptyCustomerForm: CustomerForm = {
  companyName: "",
  firstName: "",
  lastName: "",
  street: "",
  postalCode: "",
  city: "",
  country: "",
  notes: "",
};

export default function ShipmentsPage() {
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
  const [products, setProducts] = useState<Product[]>([]);
  const [itemForm, setItemForm] = useState<ShipmentItemDraft>(createEmptyItemForm());
  const [items, setItems] = useState<ShipmentItemDraft[]>([]);
  const [customerForm, setCustomerForm] =
    useState<CustomerForm>(emptyCustomerForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const valveLabel = useMemo(
    () => ({
      NONE: t.valveNone,
      SMALL: t.valveSmall,
      LARGE: t.valveLarge,
    }),
    [t]
  );

  const modelLabel = useMemo(() => t.models, [t]);

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

  const loadProducts = async () => {
    const response = await fetch("/api/products");
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: Product[] = await response.json();
    setProducts(data);
    if (data.length > 0 && itemForm.serialNumber === 0) {
      const first = data.find((item) => item.model === itemForm.model) ?? data[0];
      if (first) {
        setItemForm((prev) => ({ ...prev, serialNumber: first.serialNumber }));
      }
    }
  };

  useEffect(() => {
    loadProducts().catch(() => {
      setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
    });
  }, []);

  useEffect(() => {
    const serials = productNumbersByModel[itemForm.model];
    if (serials.length > 0 && !serials.includes(itemForm.serialNumber)) {
      setItemForm((prev) => ({
        ...prev,
        serialNumber: serials[0],
      }));
    }
  }, [itemForm.model, itemForm.serialNumber, productNumbersByModel]);

  const handleItemChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type, checked } = event.target;
    setItemForm((prev) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "serialNumber"
          ? Number(value)
          : type === "checkbox"
          ? checked
          : value,
    }));
  };

  const handleCustomerChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = event.target;
    setCustomerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (!itemForm.buildNumber.trim() || !itemForm.buildDate) {
      setNotice({ type: "error", message: t.error + t.buildNumber });
      return;
    }
    if (itemForm.serialNumber <= 0) {
      setNotice({ type: "error", message: t.error + t.serialNumber });
      return;
    }
    if (itemForm.quantity <= 0) {
      setNotice({ type: "error", message: t.error + t.quantity });
      return;
    }
    setItems((prev) => [...prev, itemForm]);
    setItemForm((prev) => ({
      ...createEmptyItemForm(),
      model: prev.model,
      serialNumber: prev.serialNumber,
      variant: prev.variant,
      isSchwenkbock: prev.isSchwenkbock,
    }));
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleShipmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (!items.length) {
      setNotice({ type: "error", message: t.shipmentItemEmpty });
      return;
    }
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    const response = await fetch("/api/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...customerForm,
        items,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.message ? `${t.error}${body.message}` : t.error;
      setNotice({ type: "error", message });
      setIsSubmitting(false);
      return;
    }

    setItemForm(createEmptyItemForm());
    setItems([]);
    setCustomerForm(emptyCustomerForm);
    setNotice({ type: "success", message: t.shipmentSaved });
    setTimeout(() => {
      setNotice(null);
    }, 1800);
    setIsSubmitting(false);
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
                      d="M4 7h12l4 4v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z"
                      fill="currentColor"
                      opacity="0.14"
                    />
                    <path
                      d="M4 7h12l4 4v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16 7v4h4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
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

        {notice && notice.type === "error" && (
          <div className={`alert ${notice.type === "success" ? "success" : ""}`}>
            {notice.message}
          </div>
        )}
        {notice && notice.type === "success" && (
          <div className="success-overlay" role="status" aria-live="polite">
            <div className="success-card">
              <div className="success-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path
                    d="M5 13l4 4L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="success-text">{notice.message}</div>
            </div>
          </div>
        )}

        <section className="card card-narrow shipment-items-card">
          <form className="form" onSubmit={handleAddItem}>
            <div className="card-header">
              <div>
                <h2 className="title title-with-icon">
                  <span className="title-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.08" />
                    </svg>
                  </span>
                  {t.shipmentItemsTitle}
                </h2>
                <p className="subtitle">{t.shipmentItemsSubtitle}</p>
              </div>
              <label className="header-field">
                <span>{t.buildDate}</span>
                <input
                  type="date"
                  name="buildDate"
                  value={itemForm.buildDate}
                  onChange={handleItemChange}
                  required
                />
              </label>
            </div>
            <div className="form-row form-row-compact">
              <label>
                {t.modelLabel}
                <select
                  className="select-compact select-centered"
                  name="model"
                  value={itemForm.model}
                  onChange={handleItemChange}
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
                  className="select-compact select-centered"
                  name="serialNumber"
                  value={itemForm.serialNumber}
                  onChange={handleItemChange}
                >
                  {productNumbersByModel[itemForm.model].map((serial) => (
                    <option key={serial} value={serial}>
                      {serial}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.quantity}
                <input
                  className="input-compact input-centered"
                  type="number"
                  name="quantity"
                  min={1}
                  value={itemForm.quantity}
                  onChange={handleItemChange}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                {t.buildNumber}
                <input
                  className="input-compact input-centered"
                  name="buildNumber"
                  value={itemForm.buildNumber}
                  onChange={handleItemChange}
                  required
                />
              </label>
            </div>
            <div className="parts-grid">
              <div className="parts-column">
                <label>
                  {t.variant}
                  <select
                    className="select-compact select-centered select-tight"
                    name="variant"
                    value={itemForm.variant}
                    onChange={handleItemChange}
                  >
                    <option value="ZINC">{variantLabel.ZINC}</option>
                    <option value="ORANGE">{variantLabel.ORANGE}</option>
                  </select>
                </label>
                <label>
                  {t.valveType}
                  <select
                    className="select-compact select-centered select-tight"
                    name="valveType"
                    value={itemForm.valveType}
                    onChange={handleItemChange}
                  >
                    {valveTypes.map((type) => (
                      <option key={type} value={type}>
                        {valveLabel[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="switch">
                  <span>{t.schwenkbock}</span>
                  <input
                    type="checkbox"
                    name="isSchwenkbock"
                    checked={itemForm.isSchwenkbock}
                    onChange={handleItemChange}
                  />
                </label>
                <label className="switch">
                  <span>{t.bucketHolder}</span>
                  <input
                    type="checkbox"
                    name="bucketHolder"
                    checked={itemForm.bucketHolder}
                    onChange={handleItemChange}
                  />
                </label>
              </div>
            </div>
            <label>
              {t.extraParts}
              <textarea
                name="extraParts"
                value={itemForm.extraParts}
                onChange={handleItemChange}
              />
            </label>
            <div className="form-actions">
              <button className="button" type="submit">
                <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 12h9M12 8l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t.addShipmentItem}
              </button>
            </div>
          </form>

          <div className="shipment-items" style={{ marginTop: 18 }}>
            {items.length === 0 && <p>{t.shipmentItemEmpty}</p>}
            {items.map((item, index) => (
              <div
                key={`${item.model}-${item.serialNumber}-${index}`}
                className="shipment-item-card"
              >
                <div className="shipment-item-head">
                  <div className="shipment-title">
                    {modelLabel[item.model]} {item.serialNumber}
                    <span className="shipment-build-number">{item.buildNumber}</span>
                  </div>
                  <div className="shipment-item-actions">
                    <span className="item-date">{item.buildDate}</span>
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
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
                </div>
                <div className="shipment-item-meta">
                  <span className="pill">{t.quantity}: {item.quantity}</span>
                  <span className="pill">{variantLabel[item.variant]}</span>
                </div>
                <div className="shipment-item-tags">
                  <span className={`item-chip ${item.isSchwenkbock ? "on" : "off"}`}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 4v4l3-3M12 20v-4l-3 3M5 12h14"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {t.schwenkbock}: {item.isSchwenkbock ? t.yes : t.no}
                  </span>
                  <span className={`item-chip ${item.bucketHolder ? "on" : "off"}`}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 8h12l-1 10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8zM9 8V6a3 3 0 0 1 6 0v2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {t.bucketHolder}: {item.bucketHolder ? t.yes : t.no}
                  </span>
                  <span className="item-chip">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 5v14M7 9h10M7 15h10"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                    {t.valveType}: {valveLabel[item.valveType]}
                  </span>
                </div>
                {item.extraParts && (
                  <div className="shipment-item-notes">
                    <span className="pill">{t.extraParts}</span>
                    <span className="muted">{item.extraParts}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="card card-narrow customer-card">
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
                {t.shipmentCustomerTitle}
              </h2>
              <p className="subtitle">{t.shipmentCustomerSubtitle}</p>
            </div>
          </div>
          <form className="form customer-form" onSubmit={handleShipmentSubmit}>
            <div className="customer-grid">
              <label className="customer-wide">
                <span className="label-with-icon">
                  <span className="label-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9zM7 9V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {t.companyName}
                </span>
                <input
                  name="companyName"
                  value={customerForm.companyName}
                  onChange={handleCustomerChange}
                  required
                />
              </label>
              <label>
                <span className="label-with-icon">
                  <span className="label-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM4 20a8 8 0 0 1 16 0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {t.firstName}
                </span>
                <input
                  name="firstName"
                  value={customerForm.firstName}
                  onChange={handleCustomerChange}
                  required
                />
              </label>
              <label>
                <span className="label-with-icon">
                  <span className="label-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM4 20a8 8 0 0 1 16 0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {t.lastName}
                </span>
                <input
                  name="lastName"
                  value={customerForm.lastName}
                  onChange={handleCustomerChange}
                  required
                />
              </label>
              <label className="customer-wide">
                <span className="label-with-icon">
                  <span className="label-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M4 10h16M6 10v9h12v-9M9 10V6h6v4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {t.street}
                </span>
                <input
                  name="street"
                  value={customerForm.street}
                  onChange={handleCustomerChange}
                  required
                />
              </label>
              <label>
                <span className="label-with-icon">
                  <span className="label-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M4 7h16v10H4zM7 10h10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {t.postalCode}
                </span>
                <input
                  name="postalCode"
                  value={customerForm.postalCode}
                  onChange={handleCustomerChange}
                  required
                />
              </label>
              <label>
                <span className="label-with-icon">
                  <span className="label-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M6 19V9l6-4 6 4v10M9 19v-4h6v4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {t.city}
                </span>
                <input
                  name="city"
                  value={customerForm.city}
                  onChange={handleCustomerChange}
                  required
                />
              </label>
              <label className="customer-wide">
                <span className="label-with-icon">
                  <span className="label-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M12 3v18M4 7h16M4 17h16M6 7c2.5 2.5 2.5 7.5 0 10M18 7c-2.5 2.5-2.5 7.5 0 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {t.country}
                </span>
                <input
                  name="country"
                  value={customerForm.country}
                  onChange={handleCustomerChange}
                  required
                />
              </label>
              <label className="customer-wide">
                <span className="label-with-icon">
                  <span className="label-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M6 5h9l3 3v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 12h6M9 16h6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {t.notes}
                </span>
                <textarea
                  name="notes"
                  value={customerForm.notes}
                  onChange={handleCustomerChange}
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                className="button"
                type="submit"
                disabled={items.length === 0 || isSubmitting}
              >
                <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 12h9M12 8l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t.saveShipment}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
