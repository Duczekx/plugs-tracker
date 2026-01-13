"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { labels, Lang } from "@/lib/i18n";

type Variant = "ZINC" | "ORANGE";
type Model = "FL_640" | "FL_540" | "FL_470" | "FL_400" | "FL_340" | "FL_260";
type ValveType = "NONE" | "SMALL" | "LARGE";

type ShipmentItem = {
  id: number;
  model: Model;
  serialNumber: number;
  variant: Variant;
  isSchwenkbock: boolean;
  quantity: number;
  buildNumber: string;
  buildDate: string;
  bucketHolder: boolean;
  valveType: ValveType;
  extraParts?: string | null;
};

type Shipment = {
  id: number;
  companyName: string;
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  notes?: string | null;
  createdAt: string;
  items: ShipmentItem[];
};

type ShipmentItemDraft = Omit<ShipmentItem, "id">;

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

const emptyItemForm: ShipmentItemDraft = {
  model: "FL_540",
  serialNumber: 0,
  variant: "ZINC",
  isSchwenkbock: false,
  quantity: 1,
  buildNumber: "",
  buildDate: "",
  bucketHolder: false,
  valveType: "NONE",
  extraParts: "",
};

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

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 10);
};

export default function SentPage() {
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
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [filter, setFilter] = useState({
    buildNumber: "",
    company: "",
  });
  const [editId, setEditId] = useState<number | null>(null);
  const [editItems, setEditItems] = useState<ShipmentItemDraft[]>([]);
  const [editItemForm, setEditItemForm] =
    useState<ShipmentItemDraft>(emptyItemForm);
  const [editCustomer, setEditCustomer] =
    useState<CustomerForm>(emptyCustomerForm);
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

  const filteredShipments = useMemo(() => {
    return shipments.filter((shipment) => {
      const buildQuery = filter.buildNumber.trim().toLowerCase();
      const companyQuery = filter.company.trim().toLowerCase();
      if (companyQuery) {
        const target = `${shipment.companyName} ${shipment.firstName} ${shipment.lastName}`.toLowerCase();
        if (!target.includes(companyQuery)) {
          return false;
        }
      }
      return shipment.items.some((item) => {
        if (buildQuery && !item.buildNumber.toLowerCase().includes(buildQuery)) {
          return false;
        }
        return true;
      });
    });
  }, [shipments, filter]);

  const loadProducts = async () => {
    const response = await fetch("/api/products");
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: Product[] = await response.json();
    setProducts(data);
    if (data.length > 0 && editItemForm.serialNumber === 0) {
      const first = data.find((item) => item.model === editItemForm.model) ?? data[0];
      if (first) {
        setEditItemForm((prev) => ({ ...prev, serialNumber: first.serialNumber }));
      }
    }
  };

  const loadShipments = async () => {
    const response = await fetch("/api/shipments", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: Shipment[] = await response.json();
    const unique = data.filter(
      (shipment, index, all) =>
        all.findIndex((item) => item.id === shipment.id) === index
    );
    setShipments(unique);
  };

  useEffect(() => {
    Promise.all([loadProducts(), loadShipments()]).catch(() => {
      setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
    });
  }, []);

  useEffect(() => {
    const serials = productNumbersByModel[editItemForm.model];
    if (serials.length > 0 && !serials.includes(editItemForm.serialNumber)) {
      setEditItemForm((prev) => ({
        ...prev,
        serialNumber: serials[0],
      }));
    }
  }, [editItemForm.model, editItemForm.serialNumber, productNumbersByModel]);

  const handleFilterChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setFilter((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditItemChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const target = event.target as HTMLInputElement;
    const { name, value, type } = target;
    setEditItemForm((prev) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "serialNumber"
          ? Number(value)
          : type === "checkbox"
          ? target.checked
          : value,
    }));
  };

  const handleCustomerChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = event.target;
    setEditCustomer((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddEditItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editItemForm.buildNumber.trim() || !editItemForm.buildDate) {
      setNotice({ type: "error", message: t.error + t.buildNumber });
      return;
    }
    if (editItemForm.serialNumber <= 0) {
      setNotice({ type: "error", message: t.error + t.serialNumber });
      return;
    }
    if (editItemForm.quantity <= 0) {
      setNotice({ type: "error", message: t.error + t.quantity });
      return;
    }
    setEditItems((prev) => [...prev, editItemForm]);
    setEditItemForm((prev) => ({
      ...emptyItemForm,
      model: prev.model,
      serialNumber: prev.serialNumber,
      variant: prev.variant,
      isSchwenkbock: prev.isSchwenkbock,
    }));
  };

  const handleRemoveEditItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleStartEdit = (shipment: Shipment) => {
    setEditId(shipment.id);
    setEditCustomer({
      companyName: shipment.companyName,
      firstName: shipment.firstName,
      lastName: shipment.lastName,
      street: shipment.street,
      postalCode: shipment.postalCode,
      city: shipment.city,
      country: shipment.country,
      notes: shipment.notes ?? "",
    });
    setEditItems(
      shipment.items.map((item) => ({
        model: item.model,
        serialNumber: item.serialNumber,
        variant: item.variant,
        isSchwenkbock: item.isSchwenkbock,
        quantity: item.quantity,
        buildNumber: item.buildNumber,
        buildDate: formatDate(item.buildDate),
        bucketHolder: item.bucketHolder,
        valveType: item.valveType,
        extraParts: item.extraParts ?? "",
      }))
    );
    setEditItemForm(emptyItemForm);
    setNotice(null);
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditItems([]);
    setEditCustomer(emptyCustomerForm);
    setEditItemForm(emptyItemForm);
  };

  const handleUpdateShipment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editId) {
      return;
    }
    if (!editItems.length) {
      setNotice({ type: "error", message: t.shipmentItemEmpty });
      return;
    }
    const response = await fetch(`/api/shipments/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editCustomer,
        items: editItems,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.message ? `${t.error}${body.message}` : t.error;
      setNotice({ type: "error", message });
      return;
    }
    await loadShipments();
    setNotice({ type: "success", message: t.saved });
    handleCancelEdit();
  };

  const handleDeleteShipment = async (id: number) => {
    if (!confirm(t.confirmDeleteShipment)) {
      return;
    }
    const response = await fetch(`/api/shipments/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.message ? `${t.error}${body.message}` : t.error;
      setNotice({ type: "error", message });
      return;
    }
    setShipments((prev) => prev.filter((shipment) => shipment.id !== id));
    await loadShipments();
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

        {notice && (
          <div className={`alert ${notice.type === "success" ? "success" : ""}`}>
            {notice.message}
          </div>
        )}

        {editId && (
          <section className="card">
            <div className="card-header">
              <div>
                <h2 className="title title-with-icon">
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
                    </svg>
                  </span>
                  {t.editShipment}
                </h2>
                <p className="subtitle">{t.shipmentItemsSubtitle}</p>
              </div>
              <div className="card-actions">
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={handleCancelEdit}
                >
                  {t.cancel}
                </button>
              </div>
            </div>
            <form className="form" onSubmit={handleAddEditItem}>
              <div className="form-row form-row-compact">
                <label>
                  {t.modelLabel}
                  <select
                    className="select-compact"
                    name="model"
                    value={editItemForm.model}
                    onChange={handleEditItemChange}
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
                    className="select-compact"
                    name="serialNumber"
                    value={editItemForm.serialNumber}
                    onChange={handleEditItemChange}
                  >
                    {productNumbersByModel[editItemForm.model].map((serial) => (
                      <option key={serial} value={serial}>
                        {serial}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.quantity}
                  <input
                    className="input-compact"
                    type="number"
                    name="quantity"
                    min={1}
                    value={editItemForm.quantity}
                    onChange={handleEditItemChange}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  {t.buildNumber}
                  <input
                    className="input-compact"
                    name="buildNumber"
                    value={editItemForm.buildNumber}
                    onChange={handleEditItemChange}
                    required
                  />
                </label>
                <label>
                  {t.buildDate}
                  <input
                    type="date"
                    name="buildDate"
                    value={editItemForm.buildDate}
                    onChange={handleEditItemChange}
                    required
                  />
                </label>
              </div>
              <div className="parts-grid">
                <div className="parts-column">
                <label>
                  {t.variant}
                  <select
                    className="select-compact"
                    name="variant"
                    value={editItemForm.variant}
                    onChange={handleEditItemChange}
                  >
                      <option value="ZINC">{variantLabel.ZINC}</option>
                      <option value="ORANGE">{variantLabel.ORANGE}</option>
                    </select>
                  </label>
                <label>
                  {t.valveType}
                  <select
                    className="select-compact"
                    name="valveType"
                    value={editItemForm.valveType}
                    onChange={handleEditItemChange}
                  >
                      {valveTypes.map((type) => (
                        <option key={type} value={type}>
                          {valveLabel[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="parts-column">
                  <label className="switch">
                    <span>{t.schwenkbock}</span>
                    <input
                      type="checkbox"
                      name="isSchwenkbock"
                      checked={editItemForm.isSchwenkbock}
                      onChange={handleEditItemChange}
                    />
                  </label>
                  <label className="switch">
                    <span>{t.bucketHolder}</span>
                    <input
                      type="checkbox"
                      name="bucketHolder"
                      checked={editItemForm.bucketHolder}
                      onChange={handleEditItemChange}
                    />
                  </label>
                </div>
              </div>
              <label>
                {t.extraParts}
                <textarea
                  name="extraParts"
                  value={editItemForm.extraParts}
                  onChange={handleEditItemChange}
                />
              </label>
              <div className="form-actions">
                <button className="button" type="submit" disabled={editItems.length === 0}>
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
              {editItems.length === 0 && <p>{t.shipmentItemEmpty}</p>}
              {editItems.map((item, index) => (
                <div
                  key={`${item.model}-${item.serialNumber}-${index}`}
                  className="shipment-item-card"
                >
                  <div className="shipment-item-head">
                    <div className="shipment-title">
                      {modelLabel[item.model]} {item.serialNumber}
                      <span className="shipment-build-number">{item.buildNumber}</span>
                      <span className="pill variant-pill">{variantLabel[item.variant]}</span>
                    </div>
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={() => handleRemoveEditItem(index)}
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
                  <div className="shipment-item-meta">
                    <span className="pill">{t.quantity}: {item.quantity}</span>
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

            <form className="form" onSubmit={handleUpdateShipment}>
              <div className="card-header">
                <div>
                  <h3 className="title title-with-icon">
                    <span className="title-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M6 7h12M6 12h6M6 17h10"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    {t.shipmentCustomerTitle}
                  </h3>
                </div>
              </div>
              <label>
                {t.companyName}
                <input
                  name="companyName"
                  value={editCustomer.companyName}
                  onChange={handleCustomerChange}
                  required
                />
              </label>
              <div className="form-row">
                <label>
                  {t.firstName}
                  <input
                    name="firstName"
                    value={editCustomer.firstName}
                    onChange={handleCustomerChange}
                    required
                  />
                </label>
                <label>
                  {t.lastName}
                  <input
                    name="lastName"
                    value={editCustomer.lastName}
                    onChange={handleCustomerChange}
                    required
                  />
                </label>
              </div>
              <label>
                {t.street}
                <input
                  name="street"
                  value={editCustomer.street}
                  onChange={handleCustomerChange}
                  required
                />
              </label>
              <div className="form-row">
                <label>
                  {t.postalCode}
                  <input
                    name="postalCode"
                    value={editCustomer.postalCode}
                    onChange={handleCustomerChange}
                    required
                  />
                </label>
                <label>
                  {t.city}
                  <input
                    name="city"
                    value={editCustomer.city}
                    onChange={handleCustomerChange}
                    required
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  {t.country}
                  <input
                    name="country"
                    value={editCustomer.country}
                    onChange={handleCustomerChange}
                    required
                  />
                </label>
              </div>
              <label>
                {t.notes}
                <textarea
                  name="notes"
                  value={editCustomer.notes}
                  onChange={handleCustomerChange}
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
                  {t.updateShipment}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="title title-with-icon">
                <span className="title-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M3.5 9h12l3 3v6a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V9z"
                      fill="currentColor"
                      opacity="0.12"
                    />
                    <path
                      d="M3.5 9h12l3 3v6a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V9zM15.5 9v4h3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {t.sentTitle}
              </h2>
              <p className="subtitle">{t.sentSubtitle}</p>
            </div>
            <div className="badge-stack">
              <span className="pill">{t.sentTab}</span>
              <span className="badge-glow">{filteredShipments.length}</span>
            </div>
          </div>
          <div className="filter-row">
            <span className="pill">{t.filters}</span>
            <input
              name="company"
              value={filter.company}
              onChange={handleFilterChange}
              placeholder={t.companyNameSearch}
            />
            <input
              name="buildNumber"
              value={filter.buildNumber}
              onChange={handleFilterChange}
              placeholder={t.buildNumber}
            />
          </div>
          <div className="shipments-list sent-list" style={{ marginTop: 16 }}>
            {filteredShipments.length === 0 && <p>{t.statusEmpty}</p>}
            {filteredShipments.map((shipment) => (
              <details key={shipment.id} className="shipment-item sent-item" open={false}>
                <summary className="shipment-summary">
                  <div className="shipment-summary-main">
                    <span className="expand-icon expand-icon-left" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M7 10l5 5 5-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <div className="shipment-date">
                      <span className="item-date">{formatDate(shipment.createdAt)}</span>
                    </div>
                    <div className="shipment-title">
                      {shipment.companyName} - {shipment.firstName} {shipment.lastName}
                    </div>
                    <div className="muted address-compact">
                      {shipment.street}, {shipment.postalCode} {shipment.city},{" "}
                      {shipment.country}
                    </div>
                  </div>
                  <div className="shipment-summary-right">
                    <div className="shipment-actions">
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={(event) => {
                        event.preventDefault();
                        handleStartEdit(shipment);
                      }}
                    >
                      {t.editShipment}
                    </button>
                    <button
                      type="button"
                      className="button button-ghost button-small"
                      onClick={(event) => {
                        event.preventDefault();
                        handleDeleteShipment(shipment.id);
                      }}
                    >
                      {t.delete}
                    </button>
                    </div>
                  </div>
                </summary>
                <div className="shipment-items sent-items" style={{ marginTop: 10 }}>
                  {shipment.items.map((item) => (
                    <div key={item.id} className="shipment-item-card">
                    <div className="shipment-item-head">
                      <div className="shipment-title">
                        {modelLabel[item.model]} {item.serialNumber}
                        <span className="shipment-build-number">{item.buildNumber}</span>
                        <span className="pill variant-pill">{variantLabel[item.variant]}</span>
                      </div>
                      <span className="pill">{t.quantity}: {item.quantity}</span>
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
                {shipment.notes && <div className="muted">{shipment.notes}</div>}
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
