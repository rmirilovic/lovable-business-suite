import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterOperator = "=" | ">" | "<" | ">=" | "<=" | "range" | "none";

export interface ColumnFilterValue {
  operator: FilterOperator;
  value: string;
  valueTo?: string; // used for "range"
}

const EMPTY_FILTER: ColumnFilterValue = { operator: "none", value: "", valueTo: "" };

interface ColumnRangeFilterProps {
  filter: ColumnFilterValue;
  onChange: (f: ColumnFilterValue) => void;
  placeholder?: string;
  placeholderTo?: string;
  type?: "number" | "text";
  className?: string;
}

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "none", label: "—" },
  { value: "=", label: "=" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: "≥" },
  { value: "<=", label: "≤" },
  { value: "range", label: "⇔" },
];

export function emptyFilter(): ColumnFilterValue {
  return { ...EMPTY_FILTER };
}

export function applyNumericFilter(
  value: number,
  filter: ColumnFilterValue
): boolean {
  if (filter.operator === "none" || !filter.value) return true;
  const v = parseFloat(filter.value.replace(",", "."));
  if (isNaN(v)) return true;

  switch (filter.operator) {
    case "=":
      return Math.abs(value - v) < 0.005;
    case ">":
      return value > v;
    case "<":
      return value < v;
    case ">=":
      return value >= v - 0.005;
    case "<=":
      return value <= v + 0.005;
    case "range": {
      const vTo = parseFloat((filter.valueTo || "").replace(",", "."));
      if (isNaN(vTo)) return value >= v - 0.005;
      return value >= v - 0.005 && value <= vTo + 0.005;
    }
    default:
      return true;
  }
}

export function applyDateFilter(
  dateStr: string | null,
  filter: ColumnFilterValue
): boolean {
  if (filter.operator === "none" || !filter.value) return true;
  if (!dateStr) return false;

  const date = dateStr; // ISO format yyyy-MM-dd for comparison
  const v = normalizeFilterDate(filter.value);
  if (!v) return true;

  switch (filter.operator) {
    case "=":
      return date === v;
    case ">":
      return date > v;
    case "<":
      return date < v;
    case ">=":
      return date >= v;
    case "<=":
      return date <= v;
    case "range": {
      const vTo = normalizeFilterDate(filter.valueTo || "");
      if (!vTo) return date >= v;
      return date >= v && date <= vTo;
    }
    default:
      return true;
  }
}

/** Convert dd.MM.yyyy or yyyy-MM-dd to yyyy-MM-dd for comparison */
function normalizeFilterDate(input: string): string | null {
  if (!input) return null;
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  // dd.MM.yyyy
  const m = input.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export function ColumnRangeFilter({
  filter,
  onChange,
  placeholder = "Vrednost",
  placeholderTo = "Do",
  type = "number",
  className,
}: ColumnRangeFilterProps) {
  const isRange = filter.operator === "range";
  const isActive = filter.operator !== "none";

  return (
    <div className={`flex flex-col gap-0.5 ${className || ""}`}>
      <div className="flex gap-0.5">
        <Select
          value={filter.operator}
          onValueChange={(op) =>
            onChange({ ...filter, operator: op as FilterOperator })
          }
        >
          <SelectTrigger className="h-7 w-[42px] px-1 text-xs flex-shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value} className="text-xs">
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isActive && (
          <Input
            placeholder={isRange ? "Od" : placeholder}
            value={filter.value}
            onChange={(e) => onChange({ ...filter, value: e.target.value })}
            className="h-7 text-xs flex-1 min-w-0"
            type={type === "number" ? "text" : "text"}
            inputMode={type === "number" ? "decimal" : "text"}
          />
        )}
      </div>
      {isRange && (
        <Input
          placeholder={placeholderTo}
          value={filter.valueTo || ""}
          onChange={(e) => onChange({ ...filter, valueTo: e.target.value })}
          className="h-7 text-xs"
          type={type === "number" ? "text" : "text"}
          inputMode={type === "number" ? "decimal" : "text"}
        />
      )}
    </div>
  );
}
