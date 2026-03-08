import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { sr } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export interface LocaleDateInputProps {
  value: string; // ISO format: YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

// Get user's preferred date format from system locale
function getLocaleDateFormat(): { format: string; placeholder: string } {
  const locale = navigator.language || "sr-RS";
  
  // Serbian and most European locales use dd.MM.yyyy
  if (locale.startsWith("sr") || locale.startsWith("hr") || locale.startsWith("bs") || 
      locale.startsWith("sl") || locale.startsWith("de") || locale.startsWith("at")) {
    return { format: "dd.MM.yyyy", placeholder: "dd.mm.gggg" };
  }
  
  // US format
  if (locale === "en-US") {
    return { format: "MM/dd/yyyy", placeholder: "mm/dd/yyyy" };
  }
  
  // UK and most other English locales
  if (locale.startsWith("en")) {
    return { format: "dd/MM/yyyy", placeholder: "dd/mm/yyyy" };
  }
  
  // Default to Serbian format
  return { format: "dd.MM.yyyy", placeholder: "dd.mm.gggg" };
}

export function LocaleDateInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  required,
}: LocaleDateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const { format: dateFormat, placeholder: defaultPlaceholder } = React.useMemo(getLocaleDateFormat, []);

  // Convert ISO value to display format
  React.useEffect(() => {
    if (value) {
      try {
        const date = new Date(value);
        if (isValid(date)) {
          setInputValue(format(date, dateFormat, { locale: sr }));
        }
      } catch {
        setInputValue("");
      }
    } else {
      setInputValue("");
    }
  }, [value, dateFormat]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      if (!required) {
        onChange("");
      }
      return;
    }

    // Helper: try to auto-complete partial input (just day, or day.month)
    const tryAutoComplete = (raw: string): Date | null => {
      const stripped = raw.trim().replace(/\.$/, ""); // remove trailing dot
      const now = new Date();
      const parts = stripped.split(".");
      
      if (parts.length === 1 && /^\d{1,2}$/.test(parts[0])) {
        // Only day entered → use current month & year
        const d = parseInt(parts[0], 10);
        const candidate = new Date(now.getFullYear(), now.getMonth(), d);
        if (isValid(candidate) && candidate.getDate() === d) return candidate;
      }
      
      if (parts.length === 2 && /^\d{1,2}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
        // Day and month entered → use current year
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const candidate = new Date(now.getFullYear(), m, d);
        if (isValid(candidate) && candidate.getDate() === d && candidate.getMonth() === m) return candidate;
      }
      
      return null;
    };

    // Try to parse the input as a date
    try {
      const parsed = parse(inputValue, dateFormat, new Date(), { locale: sr });
      if (isValid(parsed)) {
        onChange(format(parsed, "yyyy-MM-dd"));
        return;
      }
      
      // Try common Serbian formats
      const formats = ["dd.MM.yyyy", "d.M.yyyy", "dd.MM.yy", "d.M.yy"];
      for (const fmt of formats) {
        const tryParsed = parse(inputValue, fmt, new Date(), { locale: sr });
        if (isValid(tryParsed)) {
          onChange(format(tryParsed, "yyyy-MM-dd"));
          return;
        }
      }
      
      // Try auto-complete partial input
      const autoCompleted = tryAutoComplete(inputValue);
      if (autoCompleted) {
        onChange(format(autoCompleted, "yyyy-MM-dd"));
        return;
      }
      
      // Reset to previous valid value if parse fails
      if (value) {
        const date = new Date(value);
        if (isValid(date)) {
          setInputValue(format(date, dateFormat, { locale: sr }));
        }
      }
    } catch {
      if (value) {
        const date = new Date(value);
        if (isValid(date)) {
          setInputValue(format(date, dateFormat, { locale: sr }));
        }
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date && isValid(date)) {
      onChange(format(date, "yyyy-MM-dd"));
      setOpen(false);
    }
  };

  const selectedDate = React.useMemo(() => {
    if (value) {
      const date = new Date(value);
      return isValid(date) ? date : undefined;
    }
    return undefined;
  }, [value]);

  return (
    <div className={cn("relative", className)}>
      <div className="flex">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={placeholder || defaultPlaceholder}
          disabled={disabled}
          autoComplete="off"
          className="rounded-r-none border-r-0"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className="rounded-l-none px-3"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleCalendarSelect}
              locale={sr}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
