"use client";

import { useMemo } from "react";
import type { MouseEvent } from "react";

type Part = {
  id: number;
  name: string;
  stock: number;
  unit: string;
  shopUrl?: string | null;
  shopName?: string | null;
};

type PartsLabels = {
  partsTitle: string;
  partsStock: string;
  partsUnit: string;
  shopNameLabel: string;
  shopUrlLabel: string;
  partsEmpty: string;
  partsAdjust: string;
  partsEdit: string;
  partsDelete: string;
  actionsLabel: string;
  copyName: string;
};

type PartsTableProps = {
  parts: Part[];
  labels: PartsLabels;
  mode: "public" | "admin";
  onAdjust?: (part: Part) => void;
  onEdit?: (part: Part) => void;
  onDelete?: (part: Part) => void;
};

const getStockTone = (stock: number) => {
  if (stock <= 10) {
    return "stock-badge stock-badge-low";
  }
  if (stock < 50) {
    return "stock-badge stock-badge-warn";
  }
  return "stock-badge stock-badge-good";
};

export default function PartsTable({
  parts,
  labels,
  mode,
  onAdjust,
  onEdit,
  onDelete,
}: PartsTableProps) {
  const rows = useMemo(() => parts, [parts]);

  const closeMenu = (event: MouseEvent<HTMLButtonElement>) => {
    const details = (event.currentTarget as HTMLElement).closest("details");
    if (details) {
      details.removeAttribute("open");
    }
  };

  const handleCopy = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
    } catch {}
  };

  return (
    <div className={`parts-table ${mode === "admin" ? "parts-table-admin" : "parts-table-public"}`}>
      <div className="parts-table-desktop desktop-only">
        <div className="parts-table-head">
          <div>{labels.partsTitle}</div>
          <div>{labels.partsStock}</div>
          <div>{labels.partsUnit}</div>
          <div>{labels.shopNameLabel}</div>
          <div>{labels.shopUrlLabel}</div>
          {mode === "admin" && <div>{labels.actionsLabel}</div>}
        </div>
        <div className="parts-table-body">
          {rows.length === 0 && (
            <div className="parts-table-empty muted">{labels.partsEmpty}</div>
          )}
          {rows.map((part) => (
            <div key={part.id} className="parts-table-row">
              <div className="parts-table-name">
                <div className="parts-name-text">{part.name}</div>
              </div>
              <div>
                <span className={getStockTone(part.stock)}>{part.stock}</span>
              </div>
              <div className="muted">{part.unit}</div>
              <div className="muted">{part.shopName ? part.shopName : "--"}</div>
              <div>
                {part.shopUrl ? (
                  <a
                    className="button button-ghost button-small parts-link-btn"
                    href={part.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {labels.shopUrlLabel}
                  </a>
                ) : (
                  <span className="muted">--</span>
                )}
              </div>
              {mode === "admin" && (
                <div className="parts-actions-cell">
                  <details className="parts-menu">
                    <summary
                      className="button button-ghost button-icon-only"
                      aria-label="Menu"
                      title="Menu"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                        <circle cx="18" cy="12" r="1.6" fill="currentColor" />
                      </svg>
                    </summary>
                    <div className="parts-menu-panel">
                      {onAdjust && (
                        <button
                          type="button"
                          className="button button-ghost button-small"
                          onClick={(event) => {
                            onAdjust(part);
                            closeMenu(event);
                          }}
                        >
                          {labels.partsAdjust}
                        </button>
                      )}
                      {onEdit && (
                        <button
                          type="button"
                          className="button button-ghost button-small"
                          onClick={(event) => {
                            onEdit(part);
                            closeMenu(event);
                          }}
                        >
                          <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              d="M4 20h4l10-10-4-4L4 16v4zM13 6l4 4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          {labels.partsEdit}
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className="button button-ghost button-small button-danger"
                          onClick={(event) => {
                            onDelete(part);
                            closeMenu(event);
                          }}
                        >
                          {labels.partsDelete}
                        </button>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="parts-cards mobile-only">
        {rows.length === 0 && <div className="muted">{labels.partsEmpty}</div>}
        {rows.map((part) => (
          <section key={part.id} className="card parts-card-item">
            <div className="parts-card-title">
              <div className="parts-name-text">{part.name}</div>
            </div>
            <div className="parts-card-grid">
              <div>
                <div className="parts-card-label">{labels.partsStock}</div>
                <span className={getStockTone(part.stock)}>{part.stock}</span>
              </div>
              <div>
                <div className="parts-card-label">{labels.partsUnit}</div>
                <div className="muted">{part.unit}</div>
              </div>
              <div>
                <div className="parts-card-label">{labels.shopNameLabel}</div>
                <div className="muted">{part.shopName ? part.shopName : "--"}</div>
              </div>
              <div>
                <div className="parts-card-label">{labels.shopUrlLabel}</div>
                {part.shopUrl ? (
                  <a
                    className="button button-ghost button-small button-icon-only parts-link-btn"
                    href={part.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={labels.shopUrlLabel}
                    title={labels.shopUrlLabel}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M10 14L14 10M9.5 7.5h-2a3 3 0 0 0 0 6h2M14.5 16.5h2a3 3 0 0 0 0-6h-2"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                ) : (
                  <span className="muted">--</span>
                )}
              </div>
            </div>
            {mode === "admin" && (
              <div className="parts-card-actions">
                <details className="parts-menu">
                  <summary
                    className="button button-ghost button-icon-only"
                    aria-label="Menu"
                    title="Menu"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
                    </svg>
                  </summary>
                  <div className="parts-menu-panel">
                    {onAdjust && (
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={(event) => {
                          onAdjust(part);
                          closeMenu(event);
                        }}
                      >
                        {labels.partsAdjust}
                      </button>
                    )}
                    {onEdit && (
                      <button
                        type="button"
                        className="button button-ghost button-small"
                        onClick={(event) => {
                          onEdit(part);
                          closeMenu(event);
                        }}
                      >
                        <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M4 20h4l10-10-4-4L4 16v4zM13 6l4 4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {labels.partsEdit}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        className="button button-ghost button-small button-danger"
                        onClick={(event) => {
                          onDelete(part);
                          closeMenu(event);
                        }}
                      >
                        {labels.partsDelete}
                      </button>
                    )}
                  </div>
                </details>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
