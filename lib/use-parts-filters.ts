import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseCategoryParam, serializeCategoryParam } from "@/lib/parts-search";

type UsePartsFiltersOptions = {
  syncToUrl?: boolean;
  enabled?: boolean;
  defaultSort?: string;
  debounceMs?: number;
};

const buildNextSearchParams = (
  current: URLSearchParams,
  updates: { q: string; cat: string; sort: string }
) => {
  const next = new URLSearchParams(current.toString());
  if (updates.q) {
    next.set("q", updates.q);
  } else {
    next.delete("q");
  }
  if (updates.cat) {
    next.set("cat", updates.cat);
  } else {
    next.delete("cat");
  }
  if (updates.sort) {
    next.set("sort", updates.sort);
  } else {
    next.delete("sort");
  }
  return next;
};

export const usePartsFilters = (options: UsePartsFiltersOptions = {}) => {
  const { syncToUrl = true, enabled = true, defaultSort = "name_asc", debounceMs = 300 } = options;
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQuery = searchParams.get("q") ?? "";
  const initialCategories = parseCategoryParam(
    searchParams.get("cat") ?? searchParams.get("category")
  );
  const initialSort = searchParams.get("sort") ?? defaultSort;

  const [queryInput, setQueryInput] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [sort, setSort] = useState(initialSort);

  useEffect(() => {
    setQueryInput(initialQuery);
    setQuery(initialQuery);
    setCategories(initialCategories);
    setSort(initialSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, initialSort, searchParams.toString()]);

  useEffect(() => {
    const handle = setTimeout(() => setQuery(queryInput), debounceMs);
    return () => clearTimeout(handle);
  }, [queryInput, debounceMs]);

  useEffect(() => {
    if (!syncToUrl || !enabled) {
      return;
    }
    const next = buildNextSearchParams(searchParams, {
      q: query,
      cat: serializeCategoryParam(categories),
      sort,
    });
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [query, categories, sort, enabled, syncToUrl, router, searchParams]);

  const toggleCategory = (value: string) => {
    setCategories((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return [...prev, value];
    });
  };

  const clearCategories = () => setCategories([]);

  const activeCategories = useMemo(
    () => categories.filter((value) => value && value !== "all"),
    [categories]
  );

  return {
    queryInput,
    setQueryInput,
    query,
    setQuery,
    categories: activeCategories,
    setCategories,
    toggleCategory,
    clearCategories,
    sort,
    setSort,
  };
};
