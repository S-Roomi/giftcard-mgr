import { useEffect, useState } from "react";

import { DEFAULT_SORT, isSortKey, type SortKey } from "./planner";

const SORT_STORAGE_PREFIX = "giftcard-category-sort";

/** Per-category card order, persisted in localStorage by category ID. */
export function useCategorySort(categoryId: number) {
  const [sort, setSort] = useState<SortKey>(DEFAULT_SORT);
  const sortStorageKey = `${SORT_STORAGE_PREFIX}:${categoryId}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(sortStorageKey);
      setSort(saved && isSortKey(saved) ? saved : DEFAULT_SORT);
    } catch {
      // Sorting remains usable when browser storage is unavailable.
      setSort(DEFAULT_SORT);
    }
  }, [sortStorageKey]);

  const changeSort = (value: SortKey) => {
    setSort(value);
    try {
      localStorage.setItem(sortStorageKey, value);
    } catch {
      // Keep the selection for this visit even if it cannot be persisted.
    }
  };

  return [sort, changeSort] as const;
}
