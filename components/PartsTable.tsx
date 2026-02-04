"use client";

import { useMemo, useState } from "react";

type Part = {
  id: number;
  name: string;
  stock: number;
  unit: string;
  category?: string | null;
  shopUrl?: string | null;
  shopName?: string | null;
};

type PartsLabels = {
  partsTitle: string;
  partsStock: string;
  partsCategory: string;
  partsCategoryUnknown: string;
  shopNameLabel: string;
  shopUrlLabel: string;
  partsEmpty: string;
  partsLoading: string;
  partsAdjust: string;
  partsEdit: string;
  partsDelete: string;
  actionsLabel: string;
  copyName: string;
  resultsLabel: string;
};

type PartsTableProps = {
  parts: Part[];
  labels: PartsLabels;
  mode: "public" | "admin";
  resultsCount?: number;
  isLoading?: boolean;
  onAdjust?: (part: Part) => void;
  onEdit?: (part: Part) => void;
  onDelete?: (part: Part) => void;
};

const getStockTone = (stock: number) => {
  if (stock <= 2) {
    return "stock-badge stock-badge-critical";
  }
  if (stock < 10) {
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
  resultsCount,
  isLoading,
  onAdjust,
  onEdit,
  onDelete,
}: PartsTableProps) {
  const rows = useMemo(() => parts, [parts]);
  const [activeActionId, setActiveActionId] = useState<number | null>(null);

  return (
    <div className={`parts-table ${mode === "admin" ? "parts-table-admin" : "parts-table-public"}`}>
      <div className="parts-table-desktop desktop-only">
        <div className="parts-table-head">
          <div>{labels.partsTitle}</div>
          <div>{labels.partsStock}</div>
          <div className="parts-table-head-right">
            <span>{labels.shopUrlLabel}</span>
            {typeof resultsCount === "number" && (
              <span className="pill parts-results-pill">
                {labels.resultsLabel}: {resultsCount}
              </span>
            )}
          </div>
          {mode === "admin" && <div>{labels.actionsLabel}</div>}
        </div>
        <div className="parts-table-body">
          {isLoading && <div className="parts-table-empty muted">{labels.partsLoading}</div>}
          {!isLoading && rows.length === 0 && (
            <div className="parts-table-empty muted">{labels.partsEmpty}</div>
          )}
          {!isLoading &&
            rows.map((part) => (
            <div key={part.id} className="parts-table-row">
              <div className="parts-table-name">
                <div className="parts-name-text">{part.name}</div>
                <div className="parts-meta">
                  <span className="category-badge">
                    {part.category?.trim() ? part.category : labels.partsCategoryUnknown}
                  </span>
                  {part.shopName && <span className="parts-meta-text">{part.shopName}</span>}
                </div>
              </div>
              <div>
                <span className={getStockTone(part.stock)}>{part.stock}</span>
              </div>
              <div>
                {part.shopUrl ? (
                  <a
                    className="button button-ghost button-small parts-link-btn"
                    href={part.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
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
                    {labels.shopUrlLabel}
                  </a>
                ) : (
                  <span className="muted">.</span>
                )}
              </div>
              {mode === "admin" && (
                <div className="parts-actions-cell">
                  {onAdjust && (
                    <button
                      type="button"
                      className="button button-ghost button-icon-only parts-action-btn parts-actions-inline"
                      aria-label={labels.actionsLabel}
                      title={labels.partsAdjust}
                      onClick={() => onAdjust(part)}
                    >
                      <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M12 5v14M5 12h14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      className="button button-ghost button-icon-only parts-action-btn parts-actions-inline"
                      aria-label={labels.partsEdit}
                      title={labels.partsEdit}
                      onClick={() => onEdit(part)}
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
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className="button button-ghost button-icon-only button-danger parts-action-btn parts-actions-inline"
                      aria-label={labels.partsDelete}
                      title={labels.partsDelete}
                      onClick={() => onDelete(part)}
                    >
                      <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M6 7h12M10 11v6M14 11v6M9 7l1-2h4l1 2M7 7l1 12h8l1-12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  )}
                  {(onAdjust || onEdit || onDelete) && (
                    <div className="parts-actions-mobile">
                  <button
                      type="button"
                      className="button button-ghost button-icon-only parts-action-btn"
                      aria-label={labels.actionsLabel}
                      title={labels.actionsLabel}
                      onClick={() =>
                        setActiveActionId((current) => (current === part.id ? null : part.id))
                      }
                    >
                      <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                        <circle cx="18" cy="12" r="1.6" fill="currentColor" />
                      </svg>
                    </button>
                    {activeActionId === part.id && (
                      <div
                        className="parts-actions-menu-overlay"
                        onClick={() => setActiveActionId(null)}
                      >
                        <div
                          className="parts-actions-menu-sheet"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="parts-actions-menu-header">
                            <span>{labels.actionsLabel}</span>
                            <button
                              type="button"
                              className="button button-ghost button-icon-only"
                              aria-label={labels.actionsLabel}
                              onClick={() => setActiveActionId(null)}
                            >
                              X
                            </button>
                          </div>
                          {onAdjust && (
                            <button
                              type="button"
                              className="button button-ghost parts-actions-menu-item"
                              onClick={() => {
                                onAdjust(part);
                                setActiveActionId(null);
                              }}
                            >
                              {labels.partsAdjust}
                            </button>
                          )}
                          {onEdit && (
                            <button
                              type="button"
                              className="button button-ghost parts-actions-menu-item"
                              onClick={() => {
                                onEdit(part);
                                setActiveActionId(null);
                              }}
                            >
                              {labels.partsEdit}
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              className="button button-ghost button-danger parts-actions-menu-item"
                              onClick={() => {
                                onDelete(part);
                                setActiveActionId(null);
                              }}
                            >
                              {labels.partsDelete}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>
          ))}
        </div>
      </div>

      <div className="parts-cards mobile-only">
        {isLoading && <div className="muted">{labels.partsLoading}</div>}
        {!isLoading && rows.length === 0 && <div className="muted">{labels.partsEmpty}</div>}
        {!isLoading &&
          rows.map((part) => (
          <section key={part.id} className="card parts-card-item">
            <div className="parts-card-title">
              <div className="parts-name-text">{part.name}</div>
              <span className={getStockTone(part.stock)}>{part.stock}</span>
            </div>
            <div className="parts-meta">
              <span className="category-badge">
                {part.category?.trim() ? part.category : labels.partsCategoryUnknown}
              </span>
              {part.shopName && <span className="parts-meta-text">{part.shopName}</span>}
            </div>
            <div className="parts-card-grid">
              <div>
                <div className="parts-card-label">{labels.shopUrlLabel}</div>
                {part.shopUrl ? (
                  <a
                    className="button button-ghost button-small parts-link-btn"
                    href={part.shopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
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
                    {labels.shopUrlLabel}
                  </a>
                ) : (
                  <span className="muted">.</span>
                )}
              </div>
            </div>
            {mode === "admin" && (
              <div className="parts-card-actions">
                {(onAdjust || onEdit || onDelete) && (
                  <div className="parts-actions-mobile">
                    <button
                      type="button"
                      className="button button-ghost button-icon-only parts-action-btn"
                      aria-label={labels.actionsLabel}
                      title={labels.actionsLabel}
                      onClick={() =>
                        setActiveActionId((current) => (current === part.id ? null : part.id))
                      }
                    >
                      <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                        <circle cx="18" cy="12" r="1.6" fill="currentColor" />
                      </svg>
                    </button>
                    {activeActionId === part.id && (
                      <div
                        className="parts-actions-menu-overlay"
                        onClick={() => setActiveActionId(null)}
                      >
                        <div
                          className="parts-actions-menu-sheet"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="parts-actions-menu-header">
                            <span>{labels.actionsLabel}</span>
                            <button
                              type="button"
                              className="button button-ghost button-icon-only"
                              aria-label={labels.actionsLabel}
                              onClick={() => setActiveActionId(null)}
                            >
                              X
                            </button>
                          </div>
                          {onAdjust && (
                            <button
                              type="button"
                              className="button button-ghost parts-actions-menu-item"
                              onClick={() => {
                                onAdjust(part);
                                setActiveActionId(null);
                              }}
                            >
                              {labels.partsAdjust}
                            </button>
                          )}
                          {onEdit && (
                            <button
                              type="button"
                              className="button button-ghost parts-actions-menu-item"
                              onClick={() => {
                                onEdit(part);
                                setActiveActionId(null);
                              }}
                            >
                              {labels.partsEdit}
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              className="button button-ghost button-danger parts-actions-menu-item"
                              onClick={() => {
                                onDelete(part);
                                setActiveActionId(null);
                              }}
                            >
                              {labels.partsDelete}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

