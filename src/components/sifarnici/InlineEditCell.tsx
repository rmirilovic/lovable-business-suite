import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";

interface InlineEditCellProps {
  value: string | number;
  onSave: (value: string) => Promise<void>;
  type?: "text" | "number";
  decimalPlaces?: number;
  className?: string;
  displayValue?: string;
  disabled?: boolean;
}

export function InlineEditCell({
  value,
  onSave,
  type = "text",
  decimalPlaces = 2,
  className,
  displayValue,
  disabled = false,
}: InlineEditCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [isSaving, setIsSaving] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      // Small delay to ensure input is rendered
      setTimeout(() => {
        const inputRef = type === "number" ? numberInputRef : textInputRef;
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 10);
    }
  }, [isEditing, type]);

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(String(value));
  };

  const doSave = async (valueToSave: string) => {
    if (valueToSave === String(value)) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(valueToSave);
      setIsEditing(false);
    } catch (error) {
      // Keep editing mode on error
    } finally {
      setIsSaving(false);
      pendingSaveRef.current = false;
    }
  };

  const handleSave = () => {
    doSave(editValue);
  };

  const handleCancel = () => {
    setEditValue(String(value));
    setIsEditing(false);
    pendingSaveRef.current = false;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      pendingSaveRef.current = true;
      // For number inputs, we need to get the current input value directly
      if (type === "number" && numberInputRef.current) {
        doSave(numberInputRef.current.value);
      } else {
        handleSave();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is within our container (action buttons)
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    
    // Don't double-save if Enter was already pressed
    if (pendingSaveRef.current) {
      return;
    }
    
    // For number inputs, get the value from the input element directly after LocaleNumberInput's blur formatting
    if (type === "number" && numberInputRef.current) {
      // Use setTimeout to get value after LocaleNumberInput's onBlur has run
      setTimeout(() => {
        if (numberInputRef.current && isEditing) {
          doSave(numberInputRef.current.value);
        }
      }, 0);
    } else {
      handleSave();
    }
  };

  // Handle value changes from LocaleNumberInput
  const handleNumberChange = (val: string) => {
    setEditValue(val);
  };

  if (isEditing) {
    return (
      <div ref={containerRef} className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {type === "number" ? (
          <LocaleNumberInput
            ref={numberInputRef}
            value={editValue}
            onChange={handleNumberChange}
            decimalPlaces={decimalPlaces}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={isSaving}
            className="h-7 text-sm w-28 text-right"
          />
        ) : (
          <Input
            ref={textInputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            disabled={isSaving}
            className="h-7 text-sm"
          />
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="p-1 rounded hover:bg-primary/10 text-primary"
          tabIndex={0}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 rounded hover:bg-destructive/10 text-destructive"
          tabIndex={0}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <span
      onDoubleClick={handleDoubleClick}
      className={cn(
        "cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
      title={disabled ? undefined : "Dupli klik za izmenu"}
    >
      {displayValue ?? String(value)}
    </span>
  );
}
