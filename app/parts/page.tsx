"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { labels, Lang } from "@/lib/i18n";
import PartsTable from "@/components/PartsTable";
import MobileNav from "@/app/mobile-nav";

type Part = {
  id: number;
  name: string;
  stock: number;
  unit: string;
  shopUrl?: string | null;
  shopName?: string | null;
};

type PartsResponse = {
  items: Part[];
  page: number;
  totalPages: number;
  totalCount: number;
};

const PAGE_SIZE = 50;

export default function PartsPage() {
  const [lang, setLang] = useState<Lang>("pl");
  const pathname = usePathname();
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [adjustTarget, setAdjustTarget] = useState<Part | null>(null);
  const [adjustForm, setAdjustForm] = useState({ delta: 0, note: "" });

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

  useEffect(() => {
    setIsReadOnly(document.cookie.includes("pt_mode=review"));
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(queryInput), 400);
    return () => clearTimeout(handle);
  }, [queryInput]);

  const t = labels[lang];

  const loadParts = async (nextPage: number, nextQuery: string) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("per", String(PAGE_SIZE));
    if (nextQuery) {
      params.set("q", nextQuery);
    }
    const response = await fetch(`/api/parts?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const data: PartsResponse = await response.json();
    setParts(data.items);
    setTotalPages(data.totalPages);
    setPage(data.page);
    setTotalCount(data.totalCount);
  };

  useEffect(() => {
    loadParts(1, query).catch(() => {
      setNotice({ type: "error", message: "Nie udalo sie pobrac danych." });
    });
  }, [query]);

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQueryInput(event.target.value);
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
      const body = await response.json().catch(() => null);
      const message = body?.message ? `${t.error}${body.message}` : t.error;
      setNotice({ type: "error", message });
      return;
    }
    const updated: Part = await response.json();
    setParts((prev) => prev.map((part) => (part.id === updated.id ? updated : part)));
    setNotice({ type: "success", message: t.saved });
    setAdjustTarget(null);
    setAdjustForm({ delta: 0, note: "" });
  };

  const handlePageChange = async (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    await loadParts(nextPage, query);
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
                {t.partsPageTitle}
              </h1>
              <p className="subtitle">{t.partsPageSubtitle}</p>
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
        {notice && <div className={`alert ${notice.type === "success" ? "success" : ""}`}>{notice.message}</div>}

        <section className="card parts-card">
          <div className="card-header">
            <div>
              <h2 className="title title-with-icon">
                <span className="title-icon" aria-hidden="true">
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
                  </svg>
                </span>
                {t.partsTitle}
              </h2>
              <p className="subtitle">{t.partsPageSubtitle}</p>
            </div>
          </div>

          <div className="parts-search-bar">
            <input
              value={queryInput}
              onChange={handleQueryChange}
              placeholder={t.partsSearch}
            />
            <span className="pill">
              {t.resultsLabel}: {totalCount}
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
              actionsLabel: t.actionsLabel,
              copyName: t.copyName,
            }}
            mode="public"
          />

          <div className="pagination">
            <button
              type="button"
              className="button button-ghost button-small"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
            >
              &lsaquo;
            </button>
            <span className="pill">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="button button-ghost button-small"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
            >
              &rsaquo;
            </button>
          </div>
        </section>
      </div>

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
                  disabled={isReadOnly}
                  autoFocus
                />
              </label>
              <label>
                {t.partsAdjustNote}
                <textarea
                  name="note"
                  value={adjustForm.note}
                  onChange={handleAdjustChange}
                  disabled={isReadOnly}
                />
              </label>
              <div className="form-actions">
                <button
                  type="submit"
                  className="button"
                  disabled={isReadOnly}
                >
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
