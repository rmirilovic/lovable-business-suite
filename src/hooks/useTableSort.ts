import { useState, useCallback } from "react";

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: string | null;
  direction: SortDirection;
}

export function useTableSort(
  defaultColumn: string | null = null,
  defaultDirection: SortDirection = 'asc'
) {
  const [sortColumn, setSortColumn] = useState<string | null>(defaultColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const handleSort = useCallback((column: string) => {
    if (sortColumn === column) {
      // Toggle direction or clear
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  const sortItems = useCallback(<T,>(
    items: T[],
    getValueFn: (item: T, column: string) => any
  ): T[] => {
    if (!sortColumn) return items;

    return [...items].sort((a, b) => {
      const aValue = getValueFn(a, sortColumn);
      const bValue = getValueFn(b, sortColumn);

      // Handle nulls/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;

      // String comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue, 'sr');
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Boolean comparison
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        const aNum = aValue ? 1 : 0;
        const bNum = bValue ? 1 : 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // Number comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Fallback: convert to string
      const aStr = String(aValue);
      const bStr = String(bValue);
      const comparison = aStr.localeCompare(bStr, 'sr');
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [sortColumn, sortDirection]);

  return {
    sortColumn,
    sortDirection,
    handleSort,
    sortItems,
  };
}
