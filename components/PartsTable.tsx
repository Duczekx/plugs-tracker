"use client";

import { Fragment, useMemo, useState } from "react";

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
  groupFasteners: string;
  groupElectric: string;
  groupParts: string;
  groupHydraulics: string;
  groupOther: string;
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

type GroupKey = "fasteners" | "electric" | "parts" | "hydraulics" | "other";

const normalizeCategory = (category?: string | null) => {
  const trimmed = category?.trim().toLowerCase() ?? "";
  if (!trimmed) return "inne";
  const aliasMap: Record<string, string> = {
    "sruby / podkladki / nakretki": "sruby",
    schrauben: "sruby",
    muttern: "nakretki",
    unterlegscheiben: "podkladki",
    bolzen: "bolce",
    hydraulik: "hydraulika",
    gummi: "gumy",
    elektrik: "elektryka",
    zylinder: "cylindry",
    schlaeuche: "weze",
    schlaeuchen: "weze",
    sonstiges: "inne",
  };
  return aliasMap[trimmed] ?? trimmed;
};

const foldForMatch = (value: string) =>
  value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const inferGroupFromName = (name: string): GroupKey => {
  const folded = foldForMatch(name);

  if (
    folded.includes("hydraul") ||
    folded.includes("schlauch") ||
    folded.includes("schluch") ||
    folded.includes("schlau") ||
    folded.includes("kupplung") ||
    folded.includes("fitting") ||
    folded.includes("verschraubung") ||
    folded.includes("einschrauber") ||
    folded.includes("muffe")
  ) {
    return "hydraulics";
  }
  if (
    folded.includes("schraub") ||
    folded.includes("nakret") ||
    folded.includes("mutter") ||
    folded.includes("podklad") ||
    folded.includes("scheibe") ||
    /\bm(?:[3-9]|[12]\d|30)\b/i.test(name)
  ) {
    return "fasteners";
  }
  if (
    folded.includes("kabel") ||
    folded.includes("lampe") ||
    folded.includes("leuchte") ||
    folded.includes("stecker") ||
    folded.includes("schalter") ||
    folded.includes("relais")
  ) {
    return "electric";
  }
  if (
    folded.includes("zylinder") ||
    folded.includes("bolzen") ||
    folded.includes("pin") ||
    folded.includes("link pin") ||
    folded.includes("lower link pin") ||
    folded.includes("top link pin") ||
    folded.includes("splint") ||
    folded.includes("flag") ||
    folded.includes("gummi") ||
    folded.includes("buchse")
  ) {
    return "parts";
  }
  if (folded.includes("schmiernippel") || folded.includes("dokument")) {
    return "other";
  }
  return "other";
};

const getGroupKey = (part: Part): GroupKey => {
  const normalized = normalizeCategory(part.category);
  if (normalized === "sruby" || normalized === "nakretki" || normalized === "podkladki") {
    return "fasteners";
  }
  if (normalized === "elektryka") {
    return "electric";
  }
  if (normalized === "hydraulika" || normalized === "weze") {
    return "hydraulics";
  }
  if (normalized === "cylindry" || normalized === "bolce" || normalized === "gumy") {
    return "parts";
  }
  if (normalized === "inne") {
    return inferGroupFromName(part.name);
  }
  return inferGroupFromName(part.name);
};

const getStockTone = (stock: number, category?: string | null) => {
  const normalized = normalizeCategory(category);
  let redLimit = 2;
  let orangeLimit = 10;
  let greenStart = 50;

  if (normalized === "bolce" || normalized === "cylindry") {
    redLimit = 10;
    orangeLimit = 21;
    greenStart = 22;
  } else if (normalized === "elektryka") {
    redLimit = 20;
    orangeLimit = 31;
    greenStart = 32;
  } else if (normalized === "gumy" || normalized === "hydraulika" || normalized === "inne") {
    redLimit = 10;
    orangeLimit = 20;
    greenStart = 21;
  } else if (normalized === "sruby" || normalized === "nakretki" || normalized === "podkladki") {
    redLimit = 50;
    orangeLimit = 100;
    greenStart = 101;
  } else if (normalized === "weze") {
    redLimit = 10;
    orangeLimit = 20;
    greenStart = 21;
  }

  if (stock <= redLimit) {
    return "stock-badge stock-badge-critical";
  }
  if (stock < orangeLimit) {
    return "stock-badge stock-badge-low";
  }
  if (stock < greenStart) {
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
  const groupedRows = useMemo(() => {
    const groups: Record<GroupKey, Part[]> = {
      fasteners: [],
      electric: [],
      parts: [],
      hydraulics: [],
      other: [],
    };

    for (const part of parts) {
      groups[getGroupKey(part)].push(part);
    }

    const order: GroupKey[] = ["fasteners", "electric", "parts", "hydraulics", "other"];

    return order
      .map((key) => ({
        key,
        label:
          key === "fasteners"
            ? labels.groupFasteners
            : key === "electric"
              ? labels.groupElectric
              : key === "parts"
                ? labels.groupParts
                : key === "hydraulics"
                  ? labels.groupHydraulics
                  : labels.groupOther,
        items: groups[key].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.items.length > 0);
  }, [
    labels.groupElectric,
    labels.groupFasteners,
    labels.groupHydraulics,
    labels.groupOther,
    labels.groupParts,
    parts,
  ]);

  const [activeActionId, setActiveActionId] = useState<number | null>(null);

  const renderAdminActions = (part: Part) => {
    if (mode !== "admin") {
      return null;
    }

    return (
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
              onClick={() => setActiveActionId((current) => (current === part.id ? null : part.id))}
            >
              <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="6" cy="12" r="1.6" fill="currentColor" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                <circle cx="18" cy="12" r="1.6" fill="currentColor" />
              </svg>
            </button>
            {activeActionId === part.id && (
              <div className="parts-actions-menu-overlay" onClick={() => setActiveActionId(null)}>
                <div className="parts-actions-menu-sheet" onClick={(event) => event.stopPropagation()}>
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
    );
  };

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
          {!isLoading && groupedRows.length === 0 && (
            <div className="parts-table-empty muted">{labels.partsEmpty}</div>
          )}
          {!isLoading &&
            groupedRows.map((group) => (
              <Fragment key={group.key}>
                <div className="parts-group-row">{group.label}</div>
                {group.items.map((part) => (
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
                      <span className={getStockTone(part.stock, part.category)}>{part.stock}</span>
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
                    {renderAdminActions(part)}
                  </div>
                ))}
              </Fragment>
            ))}
        </div>
      </div>

      <div className="parts-cards mobile-only">
        {isLoading && <div className="muted">{labels.partsLoading}</div>}
        {!isLoading && groupedRows.length === 0 && <div className="muted">{labels.partsEmpty}</div>}
        {!isLoading &&
          groupedRows.map((group) => (
            <Fragment key={group.key}>
              <div className="parts-group-mobile">{group.label}</div>
              {group.items.map((part) => (
                <section key={part.id} className="card parts-card-item">
                  <div className="parts-card-title">
                    <div className="parts-name-text">{part.name}</div>
                    <span className={getStockTone(part.stock, part.category)}>{part.stock}</span>
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
            </Fragment>
          ))}
      </div>
    </div>
  );
}

