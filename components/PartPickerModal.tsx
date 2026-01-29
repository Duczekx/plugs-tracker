"use client";

import { useEffect, useMemo, useState } from "react";
import CategoryFilter from "@/components/CategoryFilter";
import { buildCategoryOptions, translateCategory } from "@/lib/part-categories";
import { serializeCategoryParam } from "@/lib/parts-search";
import { usePartsFilters } from "@/lib/use-parts-filters";

export type PartPickerPart = {
  id: number;
  name: string;
  stock: number;
  category?: string | null;
};

type PickerLabels = {
  title: string;
  search: string;
  categoryAll: string;
  categoryLabel: string;
  sortLabel: string;
  sortName: string;
  sortStockAsc: string;
  sortStockDesc: string;
  addLabel: string;
  closeLabel: string;
  emptyLabel: string;
};

type PartPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (part: PartPickerPart, qty: number) => void | Promise<void>;
  labels: PickerLabels;
  lang: "pl" | "de";
};

const PAGE_SIZE = 200;

export default function PartPickerModal({
  isOpen,
  onClose,
  onAdd,
  labels,
  lang,
}: PartPickerModalProps) {
  const [parts, setParts] = useState<PartPickerPart[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [qtyById, setQtyById] = useState<Record<number, number>>({});

  const filters = usePartsFilters({ syncToUrl: false, enabled: isOpen });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const fetchCategories = async () => {
      const response = await fetch("/api/parts/categories", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (Array.isArray(data.categories)) {
        setCategories(
          data.categories.filter((value: unknown): value is string => typeof value === "string")
        );
      }
    };
    fetchCategories().catch(() => null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const load = async () => {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("per", String(PAGE_SIZE));
      params.set("sort", filters.sort);
      if (filters.query) {
        params.set("q", filters.query);
      }
      if (filters.categories.length) {
        params.set("cat", serializeCategoryParam(filters.categories));
      }
      const response = await fetch(`/api/parts?${params.toString()}`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        setParts(data.items ?? []);
      }
      setIsLoading(false);
    };
    load().catch(() => setIsLoading(false));
  }, [filters.query, filters.categories, filters.sort, isOpen]);

  const categoryOptions = useMemo(
    () => buildCategoryOptions(categories, lang),
    [categories, lang]
  );

  const displayParts = useMemo(
    () =>
      parts.map((part) => ({
        ...part,
        category: translateCategory(part.category, lang) || part.category,
      })),
    [parts, lang]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <section className="card modal-card part-picker-modal">
        <div className="card-header">
          <div>
            <h3 className="title title-with-icon">{labels.title}</h3>
          </div>
          <div className="card-actions">
            <button type="button" className="button button-ghost" onClick={onClose}>
              {labels.closeLabel}
            </button>
          </div>
        </div>

        <div className="parts-toolbar">
          <CategoryFilter
            options={categoryOptions}
            activeValues={filters.categories}
            allLabel={labels.categoryAll}
            label={labels.categoryLabel}
            onChange={filters.setCategories}
          />
          <div className="parts-search-bar">
            <input
              value={filters.queryInput}
              onChange={(event) => filters.setQueryInput(event.target.value)}
              placeholder={labels.search}
              aria-label={labels.search}
            />
            <label className="parts-sort parts-sort-right">
              <span className="parts-sort-label">{labels.sortLabel}</span>
              <select
                value={filters.sort}
                onChange={(event) => filters.setSort(event.target.value)}
                className="parts-sort-select"
              >
                <option value="name_asc">{labels.sortName}</option>
                <option value="stock_asc">{labels.sortStockAsc}</option>
                <option value="stock_desc">{labels.sortStockDesc}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="part-picker-list">
          {isLoading && <div className="muted">{labels.search}...</div>}
          {!isLoading && displayParts.length === 0 && (
            <div className="muted">{labels.emptyLabel}</div>
          )}
          {!isLoading &&
            displayParts.map((part) => (
              <div key={part.id} className="part-picker-row">
                <div className="part-picker-name">
                  <div className="parts-name-text">{part.name}</div>
                  <div className="parts-meta">
                    <span className="category-badge">
                      {part.category?.trim() ? part.category : labels.categoryAll}
                    </span>
                  </div>
                </div>
                <div className="part-picker-stock">
                  <span className="stock-badge">{part.stock}</span>
                </div>
                <div className="part-picker-actions">
                  <input
                    type="number"
                    min={1}
                    step="1"
                    value={qtyById[part.id] ?? 1}
                    onChange={(event) =>
                      setQtyById((prev) => ({
                        ...prev,
                        [part.id]: Math.max(1, Number(event.target.value)),
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="button button-ghost button-small"
                    onClick={() => onAdd(part, qtyById[part.id] ?? 1)}
                  >
                    {labels.addLabel}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
