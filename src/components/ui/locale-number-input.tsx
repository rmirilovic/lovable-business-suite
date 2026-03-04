import * as React from "react";
import { cn } from "@/lib/utils";
import { getUserLocale, parseLocaleNumber } from "@/lib/formatting";

export interface LocaleNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  decimalPlaces?: number;
  /** When true, allows empty input and does not force formatting to 0 on blur. */
  allowEmpty?: boolean;
}

const LocaleNumberInput = React.forwardRef<HTMLInputElement, LocaleNumberInputProps>(
  ({ className, value, onChange, decimalPlaces = 2, allowEmpty = false, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(value);
    const [isFocused, setIsFocused] = React.useState(false);
    
    // Get locale-specific separators
    const { decimalSeparator, groupSeparator } = React.useMemo(() => {
      const locale = getUserLocale();
      const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
      return {
        decimalSeparator: parts.find(p => p.type === 'decimal')?.value || ',',
        groupSeparator: parts.find(p => p.type === 'group')?.value || '.',
      };
    }, []);

    // Normalize input: handle dot-decimal input in comma-locale
    const normalizeInput = React.useCallback((input: string): string => {
      let normalized = input.trim();
      
      // Remove any whitespace/NBSP characters (some locales use them)
      normalized = normalized.replace(/[\s\u00A0]/g, '');
      
      // If locale uses comma as decimal and user typed dot-decimal (e.g. "7215.00"),
      // convert to locale format. Heuristic: looks like "digits.1-2digits" with no comma
      if (decimalSeparator === ',' && normalized.includes('.') && !normalized.includes(',')) {
        // Check if it matches a dot-decimal pattern (e.g., "7215.00", "-123.5")
        if (/^-?\d+\.\d{1,}$/.test(normalized)) {
          normalized = normalized.replace('.', ',');
        }
      }
      
      return normalized;
    }, [decimalSeparator]);

    // Format number for display (with grouping / thousand separators)
    const formatForEdit = React.useCallback((num: number): string => {
      if (isNaN(num)) return '';
      return num.toLocaleString(getUserLocale(), {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });
    }, [decimalPlaces]);

    // Convert stored value to display value when external value changes — but NOT while focused
    React.useEffect(() => {
      if (isFocused) return;
      if (value !== undefined && value !== null) {
        // Try to parse and format with thousand separators
        const parsed = parseLocaleNumber(value.toString());
        if (!isNaN(parsed) && value.toString().trim() !== '') {
          setDisplayValue(formatForEdit(parsed));
        } else {
          setDisplayValue(value.toString());
        }
      }
    }, [value, formatForEdit, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;
      
      // Build regex that allows: minus, digits, group separator, one decimal separator
      const escapedDecimal = decimalSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedGroup = groupSeparator ? groupSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
      
      // Allow both locale separators and also dot (for user convenience - will normalize on blur)
      const validPattern = new RegExp(`^-?[0-9${escapedGroup}]*[${escapedDecimal}.]?[0-9]*$`);
      
      if (inputValue === '' || inputValue === '-' || validPattern.test(inputValue)) {
        setDisplayValue(inputValue);
        
        // Normalize and send to form state
        const normalized = normalizeInput(inputValue);
        onChange(normalized);
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);

      if (allowEmpty && (displayValue === '' || displayValue === '-')) {
        setDisplayValue('');
        onChange('');
        props.onBlur?.(e);
        return;
      }

      if (displayValue && displayValue !== '-') {
        // Normalize input first (handle dot-decimal, whitespace, etc.)
        const normalized = normalizeInput(displayValue);
        
        // Remove group separators for parsing
        let forParsing = normalized;
        if (groupSeparator) {
          forParsing = forParsing.split(groupSeparator).join('');
        }
        
        // Parse using locale-aware parser
        const numValue = parseLocaleNumber(forParsing);
        
        if (!isNaN(numValue)) {
          // Format back to locale string (without grouping, for edit clarity)
          const formatted = formatForEdit(numValue);
          setDisplayValue(formatted);
          onChange(formatted);
        }
      } else if (displayValue === '' || displayValue === '-') {
        const formatted = formatForEdit(0);
        setDisplayValue(formatted);
        onChange(formatted);
      }
      props.onBlur?.(e);
    };

    return (
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );
  }
);

LocaleNumberInput.displayName = "LocaleNumberInput";

export { LocaleNumberInput };
