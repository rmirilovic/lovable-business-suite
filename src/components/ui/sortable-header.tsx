import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortDirection } from "@/hooks/useTableSort";

interface SortableHeaderProps {
  column: string;
  label: string;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
  className?: string;
}

export function SortableHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = sortColumn === column;

  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1 hover:text-foreground transition-colors text-left w-full",
        className
      )}
      onClick={() => onSort(column)}
    >
      <span>{label}</span>
      {isActive ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="w-4 h-4 text-primary flex-shrink-0" />
        ) : (
          <ArrowDown className="w-4 h-4 text-primary flex-shrink-0" />
        )
      ) : (
        <ArrowUpDown className="w-4 h-4 opacity-40 flex-shrink-0" />
      )}
    </button>
  );
}
