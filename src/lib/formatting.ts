// Utility functions for locale-aware formatting
// Uses browser's locale settings which respect OS regional settings

/**
 * Get the user's locale from the browser
 */
export const getUserLocale = (): string => {
  return navigator.language || 'sr-RS';
};

/**
 * Format a number according to user's locale settings
 */
export const formatNumber = (
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions
): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }
  return new Intl.NumberFormat(getUserLocale(), options).format(value);
};

/**
 * Format a number as currency (without currency symbol)
 */
export const formatPrice = (value: number | null | undefined): string => {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Format a number with specific decimal places
 */
export const formatDecimal = (
  value: number | null | undefined,
  decimalPlaces: number = 2
): string => {
  return formatNumber(value, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
};

/**
 * Format an integer (no decimal places)
 */
export const formatInteger = (value: number | null | undefined): string => {
  return formatNumber(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

/**
 * Parse a locale-formatted number string to a number
 * Handles both comma and dot as decimal separators
 */
export const parseLocaleNumber = (value: string): number => {
  if (!value || value.trim() === '') {
    return 0;
  }
  
  // Get the decimal separator for the current locale
  const decimalSeparator = new Intl.NumberFormat(getUserLocale())
    .formatToParts(1.1)
    .find(part => part.type === 'decimal')?.value || '.';
  
  const thousandSeparator = new Intl.NumberFormat(getUserLocale())
    .formatToParts(1000)
    .find(part => part.type === 'group')?.value || ',';
  
  // Remove thousand separators and replace decimal separator with dot
  let normalized = value.toString();
  
  // Remove thousand separators
  if (thousandSeparator) {
    normalized = normalized.split(thousandSeparator).join('');
  }
  
  // Replace decimal separator with dot for parsing
  if (decimalSeparator !== '.') {
    normalized = normalized.replace(decimalSeparator, '.');
  }
  
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Format a date according to user's locale settings
 */
export const formatDate = (
  date: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '';
  
  return new Intl.DateTimeFormat(getUserLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  }).format(dateObj);
};

/**
 * Format a date with time according to user's locale settings
 */
export const formatDateTime = (
  date: Date | string | null | undefined
): string => {
  return formatDate(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Get locale-aware input props for number inputs
 * Returns the appropriate step and pattern for the locale
 */
export const getNumberInputProps = (decimalPlaces: number = 2) => {
  const decimalSeparator = new Intl.NumberFormat(getUserLocale())
    .formatToParts(1.1)
    .find(part => part.type === 'decimal')?.value || '.';
  
  return {
    step: Math.pow(10, -decimalPlaces).toString(),
    lang: getUserLocale(),
    inputMode: 'decimal' as const,
  };
};
