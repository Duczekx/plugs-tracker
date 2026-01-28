"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { labels, Lang } from "@/lib/i18n";
import { getCached, setCached } from "@/lib/client-cache";
import MobileNav from "@/app/mobile-nav";

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

type ExtraItemDraft = {
  name: string;
  quantity: number;
  note: string;
  partId: number | null;
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

type PartOption = {
  id: number;
  name: string;
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

const emptyExtraForm: ExtraItemDraft = {
  name: "",
  quantity: 1,
  note: "",
  partId: null,
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

const notifyEmailTo =
  process.env.NEXT_PUBLIC_NOTIFY_EMAIL_TO ?? "";
const notifyEmailCc =
  process.env.NEXT_PUBLIC_NOTIFY_EMAIL_CC ?? "";

const formatDateTime = (value: Date) =>
  value.toISOString().slice(0, 16).replace("T", " ");

const encodeMailParam = (value: string) => encodeURIComponent(value);

export default function ShipmentsPage() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem("plugs-tracker-lang");
        if (stored === "pl" || stored === "de") {
          return stored;
        }
      } catch {}
    }
    return "pl";
  });
  const pathname = usePathname();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [itemForm, setItemForm] = useState<ShipmentItemDraft>(createEmptyItemForm());
  const [items, setItems] = useState<ShipmentItemDraft[]>([]);
  const [extraForm, setExtraForm] = useState<ExtraItemDraft>(emptyExtraForm);
  const [extras, setExtras] = useState<ExtraItemDraft[]>([]);
  const [partOptions, setPartOptions] = useState<PartOption[]>([]);
  const [partQuery, setPartQuery] = useState("");
  const [customerForm, setCustomerForm] =
    useState<CustomerForm>(emptyCustomerForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [readyPrompt, setReadyPrompt] = useState<{
    shipment: {
      id: number;
      companyName: string;
      firstName: string;
      lastName: string;
      street: string;
      postalCode: string;
      city: string;
      country: string;
      items: ShipmentItemDraft[];
      extras: ExtraItemDraft[];
    };
  } | null>(null);
  const [emailPrompt, setEmailPrompt] = useState<{
    mailto: string | null;
    message: string;
    status: "READY" | "SENT";
  } | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [extraNotice, setExtraNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem("plugs-tracker-lang", lang);
    } catch {}
  }, [lang]);

  useEffect(() => {
    setIsReadOnly(document.cookie.includes("pt_mode=review"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 720px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPartQuery(extraForm.name.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [extraForm.name]);

  useEffect(() => {
    const loadPartOptions = async () => {
      const params = new URLSearchParams();
      params.set("per", "50");
      if (partQuery) {
        params.set("q", partQuery);
      }
      const response = await fetch(`/api/parts?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setPartOptions(data.items ?? []);
    };
    loadPartOptions().catch(() => null);
  }, [partQuery]);

  useEffect(() => {
    const match = partOptions.find(
      (part) => part.name.toLowerCase() === extraForm.name.trim().toLowerCase()
    );
    if (match && extraForm.partId !== match.id) {
      setExtraForm((prev) => ({ ...prev, partId: match.id }));
    }
  }, [partOptions, extraForm.name, extraForm.partId]);

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

  const buildMailto = (
    shipment: {
      id: number;
      companyName: string;
      firstName: string;
      lastName: string;
      street: string;
      postalCode: string;
      city: string;
      country: string;
      items: ShipmentItemDraft[];
      extras: ExtraItemDraft[];
    },
    status: "READY" | "SENT"
  ) => {
    if (!notifyEmailTo) {
      return null;
    }
    const de = labels.de;
    const valveLabelDe = {
      NONE: de.valveNone,
      SMALL: de.valveSmall,
      LARGE: de.valveLarge,
    };
    const bullet = "•";
    const statusText = status === "READY" ? "VERSANDBEREIT" : "GESENDET";
    const statusIcon = status === "READY" ? "🟡" : "🟢";
    const formatItemLines = (item: ShipmentItemDraft) => {
      const lines = [
        `${bullet} Plug: ${de.models[item.model]} ${item.serialNumber}`,
        `${bullet} Bau-Nr: ${item.buildNumber}`,
        `${bullet} Farbe: ${item.variant === "ZINC" ? de.variantZinc : de.variantOrange}`,
        `${bullet} Schwenkbock: ${item.isSchwenkbock ? de.yes : de.no}`,
        `${bullet} 6/2 Wegeventil: ${valveLabelDe[item.valveType]}`,
        `${bullet} Eimerhalterung: ${item.bucketHolder ? de.yes : de.no}`,
        `${bullet} Menge: ${item.quantity} stk`,
      ];
      const extraParts = item.extraParts?.trim();
      if (extraParts) {
        lines.push(`${bullet} Zusatzteile: ${extraParts}`);
      }
      lines.push("");
      return lines;
    };
    const itemLines =
      shipment.items.length > 0
        ? shipment.items.flatMap((item) => formatItemLines(item))
        : [`${bullet} keine`];
    if (itemLines[itemLines.length - 1] === "") {
      itemLines.pop();
    }
    const extraLines =
      shipment.extras.length > 0
        ? shipment.extras.map(
            (extra) =>
              `${bullet} ${extra.name} x${extra.quantity}${
                extra.note ? ` (${extra.note})` : ""
              }`
          )
        : [`${bullet} keine`];
    const subject = `[PLUGS] ${
      status === "READY" ? "Versandbereit" : "Gesendet"
    } ${shipment.companyName} ${shipment.id}`;
    const bodyLines = [
      "FS LAGER | BENACHRICHTIGUNG",
      "========================================",
      `${statusIcon} Status: ${statusText}    Datum: ${formatDateTime(new Date())}`,
      "",
      `Kunde: ${shipment.companyName} ${shipment.firstName} ${shipment.lastName}`,
      `Adresse: ${shipment.street}, ${shipment.postalCode} ${shipment.city}, ${shipment.country}`,
      "",
      "POSITIONEN:",
      ...itemLines,
      "",
      "ZUSAETZLICHE TEILE:",
      ...extraLines,
      "",
      "Diese Nachricht wurde automatisch von FS LAGER erstellt.",
    ];
    const body = bodyLines.join("\r\n");
    const query = [
      notifyEmailCc ? `cc=${encodeMailParam(notifyEmailCc)}` : null,
      `subject=${encodeMailParam(subject)}`,
      `body=${encodeMailParam(body)}`,
    ]
      .filter(Boolean)
      .join("&");
    return `mailto:${encodeURIComponent(notifyEmailTo)}?${query}`;
  };

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

  const applyProducts = (data: Product[]) => {
    setProducts(data);
    if (data.length > 0 && itemForm.serialNumber === 0) {
      const first = data.find((item) => item.model === itemForm.model) ?? data[0];
      if (first) {
        setItemForm((prev) => ({ ...prev, serialNumber: first.serialNumber }));
      }
    }
  };

  const loadProducts = async () => {
    const cached = getCached<Product[]>("products");
    if (cached) {
      applyProducts(cached);
      return;
    }
    const response = await fetch("/api/products", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: Product[] = await response.json();
    setCached("products", data);
    applyProducts(data);
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
    const target = event.target as HTMLInputElement;
    const { name, value, type } = target;
    setItemForm((prev) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "serialNumber"
          ? Number(value)
          : type === "checkbox"
          ? target.checked
          : value,
    }));
  };

  const handleHeaderBuildDatePickerChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const nextValue = event.target.value;
    setItemForm((prev) => ({ ...prev, buildDate: nextValue }));
  };

  const handleCustomerChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = event.target;
    setCustomerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleExtraChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >
  ) => {
    const target = event.target as HTMLInputElement;
    const { name, value } = target;
    const nextName = name === "name" ? value : extraForm.name;
    const match = partOptions.find(
      (part) => part.name.toLowerCase() === nextName.trim().toLowerCase()
    );
    setExtraForm((prev) => ({
      ...prev,
      [name]: name === "quantity" ? Number(value) : value,
      partId: match ? match.id : name === "name" ? null : prev.partId,
    }));
  };

  const handleAddItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (isReadOnly) {
      setNotice({ type: "error", message: t.readOnlyNotice });
      return;
    }
    if (!itemForm.buildNumber.trim() || !itemForm.buildDate) {
      setNotice({ type: "error", message: t.error + t.buildNumber });
      return;
    }
    if (itemForm.serialNumber <= 0) {
      setNotice({ type: "error", message: t.error + t.serialNumber });
      return;
    }
    if (items.some((item) => item.buildNumber === itemForm.buildNumber)) {
      setNotice({ type: "error", message: t.duplicateBuildNumber });
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

  const handleAddExtra = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setExtraNotice(null);
    if (isReadOnly) {
      setNotice({ type: "error", message: t.readOnlyNotice });
      return;
    }
    const name = extraForm.name.trim();
    const quantity = Number(extraForm.quantity);
    const note = extraForm.note.trim();
    if (name.length < 2) {
      setNotice({ type: "error", message: t.error + t.extraItemName });
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setNotice({ type: "error", message: t.error + t.quantity });
      return;
    }
    setExtras((prev) => [
      ...prev,
      { name, quantity, note, partId: extraForm.partId },
    ]);
    setExtraForm(emptyExtraForm);
    setExtraNotice({ type: "success", message: t.extraItemAdded });
    setTimeout(() => {
      setExtraNotice(null);
    }, 1400);
  };

  const handleRemoveItem = (index: number) => {
    if (isReadOnly) {
      setNotice({ type: "error", message: t.readOnlyNotice });
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleRemoveExtra = (index: number) => {
    if (isReadOnly) {
      setNotice({ type: "error", message: t.readOnlyNotice });
      return;
    }
    setExtras((prev) => prev.filter((_, idx) => idx !== index));
    setExtraNotice({ type: "success", message: t.extraItemRemoved });
    setTimeout(() => {
      setExtraNotice(null);
    }, 1400);
  };

  const handleShipmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (isReadOnly) {
      setNotice({ type: "error", message: t.readOnlyNotice });
      return;
    }
    if (!items.length && !extras.length) {
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
        extras: extras.map((extra) => ({
          name: extra.name,
          quantity: extra.quantity,
          note: extra.note ? extra.note : null,
          partId: extra.partId,
        })),
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message =
        body?.message === "Duplicate build number"
          ? t.duplicateBuildNumber
          : body?.message
          ? `${t.error}${body.message}`
          : t.error;
      setNotice({ type: "error", message });
      setIsSubmitting(false);
      return;
    }

    const shipment = await response.json().catch(() => null);

    setItemForm(createEmptyItemForm());
    setItems([]);
    setExtras([]);
    setExtraForm(emptyExtraForm);
    setCustomerForm(emptyCustomerForm);
    setNotice({ type: "success", message: t.shipmentSaved });
    setTimeout(() => {
      setNotice(null);
    }, 1800);
    setIsSubmitting(false);

    if (shipment?.id) {
      setReadyPrompt({
        shipment: {
          id: shipment.id,
          companyName: shipment.companyName,
          firstName: shipment.firstName,
          lastName: shipment.lastName,
          street: shipment.street,
          postalCode: shipment.postalCode,
          city: shipment.city,
          country: shipment.country,
          items: shipment.items ?? [],
          extras: shipment.extras ?? [],
        },
      });
    }
  };

  const handleReadyEmailChoice = async (sendEmail: boolean) => {
    if (!readyPrompt) {
      return;
    }
    const { shipment } = readyPrompt;
    setReadyPrompt(null);
    if (!sendEmail) {
      return;
    }
    if (!notifyEmailTo) {
      setEmailPrompt({
        mailto: null,
        message: t.missingNotifyEmails,
        status: "READY",
      });
      return;
    }
    const mailto = buildMailto(shipment, "READY");
    setEmailPrompt({
      mailto,
      message: t.statusSaved,
      status: "READY",
    });
  };

  return (
    <div className="app-shell shipments-page">
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
            <MobileNav lang={lang} setLang={setLang} pathname={pathname} t={t} />
            <div className="tabs">
              <Link
                className={`tab-link ${pathname === "/" ? "tab-active" : ""}`}
                href="/"
              >
                {t.inventoryTab}
              </Link>
              <Link
                className={`tab-link ${pathname === "/parts" ? "tab-active" : ""}`}
                href="/parts"
              >
                {t.partsTab}
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

        {isReadOnly && <div className="alert">{t.readOnlyNotice}</div>}
        {notice && notice.type === "error" && (
          <div className="alert">
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
        {emailPrompt && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <section className="card modal-card confirm-card">
              <div className="card-header">
                <div>
                  <h3 className="title title-with-icon">
                    <span
                      className={`title-icon confirm-icon ${
                        emailPrompt.status === "READY"
                          ? "confirm-icon-ready"
                          : "confirm-icon-sent"
                      }`}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M4 7h16v10H4z"
                          fill="currentColor"
                          opacity="0.12"
                        />
                        <path
                          d="M4 7h16v10H4z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M4 7l8 6 8-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    {t.statusSaved}
                  </h3>
                  <p className="subtitle">{emailPrompt.message}</p>
                </div>
              </div>
              <div className="confirm-actions">
                {emailPrompt.mailto ? (
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      window.location.href = emailPrompt.mailto ?? "";
                      setEmailPrompt(null);
                    }}
                  >
                    {t.openEmail}
                  </button>
                ) : (
                  <span className="muted">{t.missingNotifyEmails}</span>
                )}
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setEmailPrompt(null)}
                >
                  {t.cancel}
                </button>
              </div>
            </section>
          </div>
        )}
        {readyPrompt && (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <section className="card modal-card confirm-card">
              <div className="card-header">
                <div>
                  <h3 className="title title-with-icon">
                    <span className="title-icon confirm-icon confirm-icon-ready" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M4 7h16v10H4z"
                          fill="currentColor"
                          opacity="0.12"
                        />
                        <path
                          d="M4 7h16v10H4z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M4 7l8 6 8-6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    {t.confirmReadyTitle}
                  </h3>
                  <p className="subtitle">{t.confirmReadySubtitle}</p>
                </div>
              </div>
              <div className="confirm-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => handleReadyEmailChoice(true)}
                >
                  {t.sendEmailAction}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => handleReadyEmailChoice(false)}
                >
                  {t.skipEmailAction}
                </button>
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => setReadyPrompt(null)}
                >
                  {t.cancel}
                </button>
              </div>
            </section>
          </div>
        )}

        <div className="shipment-sections">
          <section className="card shipment-items-card">
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
                  {t.addShipmentItem}
                </h2>
                <p className="subtitle">{t.shipmentItemsSubtitle}</p>
              </div>
            </div>
            <div className="form-row form-row-compact">
              <label>
                {t.modelLabel}
                <select
                  className="select-compact select-centered"
                  name="model"
                  value={itemForm.model}
                  onChange={handleItemChange}
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
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
                    disabled={isReadOnly}
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
                    disabled={isReadOnly}
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
                    disabled={isReadOnly}
                  />
                </label>
                <label className="switch">
                  <span>{t.bucketHolder}</span>
                  <input
                    type="checkbox"
                    name="bucketHolder"
                    checked={itemForm.bucketHolder}
                    onChange={handleItemChange}
                    disabled={isReadOnly}
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
                disabled={isReadOnly}
              />
            </label>
            <div className="form-actions">
              <button className="button" type="submit" disabled={isReadOnly}>
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

          </section>

          <section className="card shipment-extra-card">
          <div className="card-header">
            <div>
              <h2 className="title title-with-icon">
                <span className="title-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M4 7h12l4 4v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z"
                      fill="currentColor"
                      opacity="0.12"
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
                {t.extraItemsTitle}
              </h2>
              <p className="subtitle">{t.extraItemsSubtitle}</p>
            </div>
          </div>
          <form className="form" onSubmit={handleAddExtra}>
            <div className="form-row extra-row">
              <label>
                {t.extraItemName}
                <input
                  name="name"
                  value={extraForm.name}
                  onChange={handleExtraChange}
                  placeholder={t.extraItemPlaceholder}
                  list="extra-part-options"
                  required
                  disabled={isReadOnly}
                  minLength={2}
                />
                <datalist id="extra-part-options">
                  {partOptions.map((part) => (
                    <option key={part.id} value={part.name} />
                  ))}
                </datalist>
              </label>
              <label>
                {t.quantity}
                <div className="quantity-stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() =>
                      setExtraForm((prev) => ({
                        ...prev,
                        quantity: Math.max(1, prev.quantity - 1),
                      }))
                    }
                    disabled={isReadOnly}
                    aria-label={`${t.quantity} -`}
                  >
                    -
                  </button>
                  <input
                    className="input-compact input-centered quantity-input"
                    type="number"
                    name="quantity"
                    min={1}
                    value={extraForm.quantity}
                    onChange={handleExtraChange}
                    disabled={isReadOnly}
                  />
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() =>
                      setExtraForm((prev) => ({
                        ...prev,
                        quantity: prev.quantity + 1,
                      }))
                    }
                    disabled={isReadOnly}
                    aria-label={`${t.quantity} +`}
                  >
                    +
                  </button>
                </div>
              </label>
            </div>
            <label>
              {t.extraItemNote}
              <textarea
                name="note"
                value={extraForm.note}
                onChange={handleExtraChange}
                placeholder={t.extraItemNotePlaceholder}
                disabled={isReadOnly}
              />
            </label>
            <div className="form-actions">
              <button
                className="button"
                type="submit"
                disabled={isReadOnly}
                title={isReadOnly ? t.readOnlyNotice : undefined}
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
                {t.extraItemAdd}
              </button>
            </div>
          </form>

          {extraNotice && (
            <div
              className={`alert ${extraNotice.type === "success" ? "success" : ""}`}
              style={{ marginTop: 16 }}
            >
              {extraNotice.message}
            </div>
          )}

          </section>

          <section className="card customer-card">
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
            <label className="customer-date-field desktop-only">
              <span className="label-with-icon">
                <span className="label-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M7 4v3M17 4v3M4 9h16M6 9h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {t.buildDate}
              </span>
              <input
                className="date-input"
                type="date"
                name="buildDate"
                value={itemForm.buildDate}
                onChange={handleHeaderBuildDatePickerChange}
                required={!isMobile}
                disabled={isMobile || isReadOnly}
              />
            </label>
          </div>
          <form
            id="shipment-form"
            className="form customer-form"
            onSubmit={handleShipmentSubmit}
          >
            <div className="customer-grid">
              <label className="customer-date-field mobile-only customer-wide">
                <span className="label-with-icon">
                  <span className="label-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M7 4v3M17 4v3M4 9h16M6 9h12v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  {t.buildDate}
                </span>
                <input
                  className="date-input"
                  type="date"
                  name="buildDateMobile"
                  value={itemForm.buildDate}
                  onChange={handleHeaderBuildDatePickerChange}
                  required={isMobile}
                  disabled={!isMobile || isReadOnly}
                />
              </label>
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
                />
              </label>
            </div>
          </form>
          </section>
        </div>

        <section className="card shipment-list-card">
          <div className="card-header">
            <div>
              <h2 className="title title-with-icon">
                <span className="title-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M4 7h12l4 4v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z"
                      fill="currentColor"
                      opacity="0.12"
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
                {t.orderSummaryTitle}
                <span className="title-note">{t.orderSummaryNote}</span>
              </h2>
              <p className="subtitle">{t.shipmentItemsSubtitle}</p>
            </div>
          </div>

          {items.length === 0 && extras.length === 0 && (
            <p>{t.shipmentItemEmpty}</p>
          )}

          <div className="shipment-list">
            {items.length > 0 && (
              <div className="shipment-list-group">
                <div className="shipment-list-group-title">{t.shipmentItemsTitle}</div>
                {items.map((item, index) => (
                  <div
                    key={`${item.model}-${item.serialNumber}-${index}`}
                    className="shipment-list-item"
                  >
                    <div className="shipment-list-main">
                      <div className="shipment-list-title">
                        {modelLabel[item.model]} {item.serialNumber}
                        <span className="shipment-build-number">{item.buildNumber}</span>
                      </div>
                      <div className="shipment-list-meta">
                        <span className="pill">{t.quantity}: {item.quantity}</span>
                        <span className="pill">{variantLabel[item.variant]}</span>
                        <span className="item-date">{item.buildDate}</span>
                        <span className={`item-chip ${item.isSchwenkbock ? "on" : "off"}`}>
                          {t.schwenkbock}: {item.isSchwenkbock ? t.yes : t.no}
                        </span>
                        <span className={`item-chip ${item.bucketHolder ? "on" : "off"}`}>
                          {t.bucketHolder}: {item.bucketHolder ? t.yes : t.no}
                        </span>
                        <span className="item-chip">
                          {t.valveType}: {valveLabel[item.valveType]}
                        </span>
                      </div>
                      {item.extraParts && (
                        <div className="shipment-list-note">
                          <span className="pill">{t.extraParts}</span>
                          <span className="muted">{item.extraParts}</span>
                        </div>
                      )}
                    </div>
                    <div className="shipment-list-actions">
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => handleRemoveItem(index)}
                        disabled={isReadOnly}
                        title={isReadOnly ? t.readOnlyNotice : undefined}
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
                ))}
              </div>
            )}

            {extras.length > 0 && (
              <div className="shipment-list-group">
                <div className="shipment-list-group-title">{t.extraItemsTitle}</div>
                {extras.map((extra, index) => (
                  <div key={`${extra.name}-${index}`} className="shipment-list-item">
                    <div className="shipment-list-main">
                      <div className="shipment-list-title">{extra.name}</div>
                      <div className="shipment-list-meta">
                        <span className="pill">{t.quantity}: {extra.quantity}</span>
                      </div>
                      {extra.note && (
                        <div className="shipment-list-note">
                          <span className="pill">{t.extraItemNote}</span>
                          <span className="muted">{extra.note}</span>
                        </div>
                      )}
                    </div>
                    <div className="shipment-list-actions">
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={() => handleRemoveExtra(index)}
                        disabled={isReadOnly}
                        title={isReadOnly ? t.readOnlyNotice : undefined}
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
                ))}
              </div>
            )}
          </div>
          <div className="form-actions">
            <button
              className="button"
              type="submit"
              form="shipment-form"
              disabled={(items.length === 0 && extras.length === 0) || isSubmitting || isReadOnly}
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
        </section>
      </div>
    </div>
  );
}



