import * as React from "react";
import { cn } from "@/lib/utils";
import { getUserLocale } from "@/lib/formatting";

export interface LocaleNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  decimalPlaces?: number;
}

const LocaleNumberInput = React.forwardRef<HTMLInputElement, LocaleNumberInputProps>(
  ({ className, value, onChange, decimalPlaces = 2, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(value);
    
    // Get locale-specific separators
    const decimalSeparator = React.useMemo(() => {
      return new Intl.NumberFormat(getUserLocale())
        .formatToParts(1.1)
        .find(part => part.type === 'decimal')?.value || '.';
    }, []);

    // Convert stored value (with dot) to display value (with locale separator)
    React.useEffect(() => {
      if (value !== undefined) {
        const display = value.toString().replace('.', decimalSeparator);
        setDisplayValue(display);
      }
    }, [value, decimalSeparator]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputValue = e.target.value;
      
      // Allow empty, minus sign, and numbers with decimal separator
      const validPattern = new RegExp(`^-?[0-9]*[${decimalSeparator}.]?[0-9]*$`);
      
      if (inputValue === '' || inputValue === '-' || validPattern.test(inputValue)) {
        setDisplayValue(inputValue);
        
        // Convert to standard format (with dot) for storage
        const standardValue = inputValue.replace(decimalSeparator, '.');
        onChange(standardValue);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Format the number on blur
      if (displayValue && displayValue !== '-') {
        const numValue = parseFloat(displayValue.replace(decimalSeparator, '.'));
        if (!isNaN(numValue)) {
          const formatted = numValue.toFixed(decimalPlaces).replace('.', decimalSeparator);
          setDisplayValue(formatted);
          onChange(numValue.toFixed(decimalPlaces));
        }
      }
      props.onBlur?.(e);
    };

    return (
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    );
  }
);

LocaleNumberInput.displayName = "LocaleNumberInput";

export { LocaleNumberInput };
