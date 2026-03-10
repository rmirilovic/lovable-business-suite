import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns minDate and maxDate (ISO strings) for the currently selected business year.
 * Use with LocaleDateInput's minDate/maxDate props to restrict document dates.
 */
export function useBusinessYearDateLimits() {
  const { selectedYear } = useAuth();

  return useMemo(() => {
    if (!selectedYear?.year) return { minDate: undefined, maxDate: undefined };
    const y = selectedYear.year;
    return {
      minDate: `${y}-01-01`,
      maxDate: `${y}-12-31`,
    };
  }, [selectedYear?.year]);
}
