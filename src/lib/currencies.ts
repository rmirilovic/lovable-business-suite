export const CURRENCIES = [
  { code: "RSD", name: "Srpski dinar" },
  { code: "EUR", name: "Evro" },
  { code: "USD", name: "Američki dolar" },
  { code: "CHF", name: "Švajcarski franak" },
  { code: "GBP", name: "Britanska funta" },
] as const;

export type CurrencyCode = typeof CURRENCIES[number]["code"];

export const isForeignCurrency = (currency: string | undefined | null): boolean =>
  !!currency && currency !== "RSD";
