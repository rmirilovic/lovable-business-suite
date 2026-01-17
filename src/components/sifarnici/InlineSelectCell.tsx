import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectOption {
  value: string;
  label: string;
}

interface InlineSelectCellProps {
  value: string;
  options: SelectOption[];
  onSave: (value: string) => Promise<void>;
  displayValue?: string;
  disabled?: boolean;
  className?: string;
}

export function InlineSelectCell({
  value,
  options,
  onSave,
  displayValue,
  disabled = false,
  className,
}: InlineSelectCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = async (newValue: string) => {
    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch (error) {
      // Keep dropdown open on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div ref={containerRef} onClick={(e) => e.stopPropagation()}>
        <Select
          value={value}
          onValueChange={handleSelect}
          disabled={isSaving}
          open={true}
          onOpenChange={(open) => {
            if (!open) setIsEditing(false);
          }}
        >
          <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={cn(
        "cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors inline-flex items-center gap-1",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
      title={disabled ? undefined : "Klikni za izmenu"}
    >
      {displayValue ?? options.find(o => o.value === value)?.label ?? value}
      {!disabled && <ChevronDown className="w-3 h-3 opacity-50" />}
    </span>
  );
}
