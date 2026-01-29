"use client";

import CategoryFilter, { CategoryOption } from "@/components/CategoryFilter";

type PartsToolbarLabels = {
  partsSearch: string;
  partsSortLabel: string;
  partsSortName: string;
  partsSortStockAsc: string;
  partsSortStockDesc: string;
  partsCategoryAll: string;
  partsCategoryLabel: string;
};

type PartsToolbarProps = {
  queryInput: string;
  onQueryChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  categoryOptions: CategoryOption[];
  activeCategories: string[];
  onCategoriesChange: (values: string[]) => void;
  labels: PartsToolbarLabels;
};

export default function PartsToolbar({
  queryInput,
  onQueryChange,
  sort,
  onSortChange,
  categoryOptions,
  activeCategories,
  onCategoriesChange,
  labels,
}: PartsToolbarProps) {
  return (
    <div className="parts-toolbar">
      <CategoryFilter
        options={categoryOptions}
        activeValues={activeCategories}
        allLabel={labels.partsCategoryAll}
        label={labels.partsCategoryLabel}
        onChange={onCategoriesChange}
      />
      <div className="parts-search-bar">
        <input
          value={queryInput}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={labels.partsSearch}
          aria-label={labels.partsSearch}
        />
        <label className="parts-sort parts-sort-right">
          <span className="parts-sort-label">{labels.partsSortLabel}</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value)}
            className="parts-sort-select"
          >
            <option value="name_asc">{labels.partsSortName}</option>
            <option value="stock_asc">{labels.partsSortStockAsc}</option>
            <option value="stock_desc">{labels.partsSortStockDesc}</option>
          </select>
        </label>
      </div>
    </div>
  );
}
