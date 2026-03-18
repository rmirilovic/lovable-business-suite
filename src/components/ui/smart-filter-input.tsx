import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

/**
 * Compact column filter that supports operator prefixes typed directly:
 *   >100   <50   >=10   <=200   100-500   =100   just "100" (contains for text, = for numbers)
 * For dates: >01.01.2025  01.01.2025-31.03.2025  etc.
 */

interface ParsedFilter {
  operator: "=" | ">" | "<" | ">=" | "<=" | "range" | "contains" | "none";
  value: number | string;
  valueTo?: number | string;
}

function parseFilterExpression(input: string, type: "number" | "date"): ParsedFilter {
  const trimmed = input.trim();
  if (!trimmed) return { operator: "none", value: "" };

  if (type === "number") {
    // Check for range: 100-500 (but not -500 which is negative)
    const rangeMatch = trimmed.match(/^(-?\d+[.,]?\d*)\s*-\s*(-?\d+[.,]?\d*)$/);
    if (rangeMatch && !trimmed.startsWith("-") || (rangeMatch && trimmed.indexOf("-", 1) > 0)) {
      const parts = trimmed.split(/(?<=\d)\s*-\s*(?=\d)/);
      if (parts.length === 2) {
        const v1 = parseFloat(parts[0].replace(",", "."));
        const v2 = parseFloat(parts[1].replace(",", "."));
        if (!isNaN(v1) && !isNaN(v2)) return { operator: "range", value: v1, valueTo: v2 };
      }
    }

    // Check operators
    const opMatch = trimmed.match(/^(>=|<=|>|<|=)\s*(.+)$/);
    if (opMatch) {
      const v = parseFloat(opMatch[2].replace(",", "."));
      if (!isNaN(v)) return { operator: opMatch[1] as any, value: v };
    }

    // Plain number = exact match
    const v = parseFloat(trimmed.replace(",", "."));
    if (!isNaN(v)) return { operator: "=", value: v };

    return { operator: "none", value: "" };
  }

  // Date type
  // Range: 01.01.2025-31.03.2025
  const dateRangeMatch = trimmed.match(/^(.+?)\s*-\s*(.+)$/);
  if (dateRangeMatch) {
    const d1 = normalizeDateInput(dateRangeMatch[1].trim());
    const d2 = normalizeDateInput(dateRangeMatch[2].trim());
    if (d1 && d2) return { operator: "range", value: d1, valueTo: d2 };
  }

  // Operator prefix
  const opMatch = trimmed.match(/^(>=|<=|>|<|=)\s*(.+)$/);
  if (opMatch) {
    const d = normalizeDateInput(opMatch[2].trim());
    if (d) return { operator: opMatch[1] as any, value: d };
  }

  // Plain date
  const d = normalizeDateInput(trimmed);
  if (d) return { operator: "=", value: d };

  return { operator: "none", value: "" };
}

/** Convert dd.MM.yyyy to yyyy-MM-dd */
function normalizeDateInput(input: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const m = input.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

export function applySmartNumericFilter(value: number, filterText: string): boolean {
  if (!filterText.trim()) return true;
  const parsed = parseFilterExpression(filterText, "number");
  if (parsed.operator === "none") return true;
  const v = parsed.value as number;

  switch (parsed.operator) {
    case "=": return Math.abs(value - v) < 0.005;
    case ">": return value > v;
    case "<": return value < v;
    case ">=": return value >= v - 0.005;
    case "<=": return value <= v + 0.005;
    case "range": return value >= (v) - 0.005 && value <= (parsed.valueTo as number) + 0.005;
    default: return true;
  }
}

export function applySmartDateFilter(dateStr: string | null, filterText: string): boolean {
  if (!filterText.trim()) return true;
  if (!dateStr) return false;
  const parsed = parseFilterExpression(filterText, "date");
  if (parsed.operator === "none") return true;
  const v = parsed.value as string;

  switch (parsed.operator) {
    case "=": return dateStr === v;
    case ">": return dateStr > v;
    case "<": return dateStr < v;
    case ">=": return dateStr >= v;
    case "<=": return dateStr <= v;
    case "range": return dateStr >= v && dateStr <= (parsed.valueTo as string);
    default: return true;
  }
}

interface SmartFilterInputProps {
  value: string;
  onChange: (v: string) => void;
  type?: "number" | "date";
  placeholder?: string;
  className?: string;
  showHelp?: boolean;
}

const HELP_NUMBER = ">100, <50, >=10, <=200, 100-500, =100";
const HELP_DATE = ">01.01.2025, 01.01.2025-31.03.2025";

export function SmartFilterInput({
  value,
  onChange,
  type = "number",
  placeholder = "Filter...",
  className,
  showHelp = false,
}: SmartFilterInputProps) {
  const helpText = type === "number" ? HELP_NUMBER : HELP_DATE;

  return (
    <div className="relative">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-7 text-xs pr-6 ${className || ""}`}
      />
      {showHelp && (
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs max-w-[220px]">
            <p className="font-medium mb-1">Podržani formati:</p>
            <p className="text-muted-foreground">{helpText}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
