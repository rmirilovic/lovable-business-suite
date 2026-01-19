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
  // Navigation props
  isEditing?: boolean;
  onStartEdit?: () => void;
  onTabNext?: () => void;
  onTabPrev?: () => void;
  onCancel?: () => void;
}

export function InlineEditCell({
  value,
  onSave,
  type = "text",
  decimalPlaces = 2,
  className,
  displayValue,
  disabled = false,
  isEditing: externalIsEditing,
  onStartEdit,
  onTabNext,
  onTabPrev,
  onCancel,
}: InlineEditCellProps) {
  // Use external control if provided, otherwise manage internally
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const isEditing = externalIsEditing !== undefined ? externalIsEditing : internalIsEditing;
  
  const [editValue, setEditValue] = useState(String(value));
  const [isSaving, setIsSaving] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingSaveRef = useRef<'save' | 'tab-next' | 'tab-prev' | null>(null);

  useEffect(() => {
    if (isEditing) {
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

  const setIsEditing = (val: boolean) => {
    if (externalIsEditing === undefined) {
      setInternalIsEditing(val);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    if (onStartEdit) {
      onStartEdit();
    } else {
      setIsEditing(true);
    }
    setEditValue(String(value));
  };

  const doSave = async (valueToSave: string, navigateAfter?: 'next' | 'prev') => {
    const valueChanged = valueToSave !== String(value);
    
    if (valueChanged) {
      setIsSaving(true);
      try {
        await onSave(valueToSave);
      } catch (error) {
        pendingSaveRef.current = null;
        setIsSaving(false);
        return; // Keep editing mode on error
      }
      setIsSaving(false);
    }
    
    pendingSaveRef.current = null;
    
    // Handle navigation after save
    if (navigateAfter === 'next' && onTabNext) {
      onTabNext();
    } else if (navigateAfter === 'prev' && onTabPrev) {
      onTabPrev();
    } else {
      if (onCancel) {
        onCancel();
      } else {
        setIsEditing(false);
      }
    }
  };

  const handleSave = () => {
    doSave(editValue);
  };

  const handleCancel = () => {
    setEditValue(String(value));
    pendingSaveRef.current = null;
    if (onCancel) {
      onCancel();
    } else {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      pendingSaveRef.current = 'save';
      if (type === "number" && numberInputRef.current) {
        doSave(numberInputRef.current.value);
      } else {
        handleSave();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const direction = e.shiftKey ? 'prev' : 'next';
      pendingSaveRef.current = e.shiftKey ? 'tab-prev' : 'tab-next';
      
      if (type === "number" && numberInputRef.current) {
        doSave(numberInputRef.current.value, direction);
      } else {
        doSave(editValue, direction);
      }
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is within our container (action buttons)
    if (containerRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    
    // Don't double-save if a key action is pending
    if (pendingSaveRef.current) {
      return;
    }
    
    if (type === "number" && numberInputRef.current) {
      setTimeout(() => {
        if (numberInputRef.current && isEditing && !pendingSaveRef.current) {
          doSave(numberInputRef.current.value);
        }
      }, 0);
    } else {
      handleSave();
    }
  };

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
            autoComplete="off"
          />
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="p-1 rounded hover:bg-primary/10 text-primary"
          tabIndex={-1}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSaving}
          className="p-1 rounded hover:bg-destructive/10 text-destructive"
          tabIndex={-1}
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
