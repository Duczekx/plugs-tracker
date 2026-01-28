"use client";

import { useMemo, useState } from "react";

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
  const [activePart, setActivePart] = useState<Part | null>(null);

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
                  <button
                    type="button"
                    className="button button-ghost button-icon-only"
                    aria-label="Menu"
                    title="Menu"
                    onClick={() => setActivePart(part)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
                    </svg>
                  </button>
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
                <button
                  type="button"
                  className="button button-ghost button-icon-only"
                  aria-label="Menu"
                  title="Menu"
                  onClick={() => setActivePart(part)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                    <circle cx="18" cy="12" r="1.6" fill="currentColor" />
                  </svg>
                </button>
              </div>
            )}
          </section>
        ))}
      </div>

      {activePart && (
        <div
          className="modal-overlay parts-action-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setActivePart(null)}
        >
          <section
            className="card parts-action-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="card-header">
              <div>
                <h3 className="title title-with-icon">{activePart.name}</h3>
                <p className="subtitle">{labels.actionsLabel}</p>
              </div>
            </div>
            <div className="parts-action-buttons">
              {onAdjust && (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    onAdjust(activePart);
                    setActivePart(null);
                  }}
                >
                  {labels.partsAdjust}
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={() => {
                    onEdit(activePart);
                    setActivePart(null);
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
                  className="button button-ghost button-danger"
                  onClick={() => {
                    onDelete(activePart);
                    setActivePart(null);
                  }}
                >
                  {labels.partsDelete}
                </button>
              )}
              <button
                type="button"
                className="button"
                onClick={() => setActivePart(null)}
              >
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
