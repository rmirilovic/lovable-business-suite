import * as XLSX from "xlsx";
import { Invoice, InvoiceItem } from "@/hooks/useInvoices";
import { format } from "date-fns";

const fmtDate = (d: string | null) =>
  d ? format(new Date(d), "dd.MM.yyyy") : "-";

export function exportInvoiceToExcel(
  invoice: Invoice,
  items: InvoiceItem[]
) {
  const rows = items.map((item, i) => ({
    "#": i + 1,
    "Šifra": item.item_code || "-",
    "Naziv": item.item_name,
    "JM": item.unit,
    "Količina": item.quantity,
    "Cena": item.unit_price,
    "Rabat %": item.discount_percent,
    "PDV %": item.vat_rate,
    "Osnovica": item.line_subtotal,
    "PDV": item.line_vat,
    "Ukupno": item.line_total,
  }));

  const wb = XLSX.utils.book_new();

  const headerData = [
    ["FAKTURA"],
    ["Broj fakture", invoice.invoice_number],
    ["Datum fakture", fmtDate(invoice.invoice_date)],
    ["Datum valute", fmtDate(invoice.due_date)],
    ["Kupac", invoice.partner_name || invoice.partner?.name || ""],
    ["PIB", invoice.partner_pib || invoice.partner?.pib || ""],
    ["MB", invoice.partner_mb || invoice.partner?.mb || ""],
    ["Fakturu sastavio", invoice.composed_by || ""],
    [],
    ["Osnovica", invoice.subtotal],
    ["PDV", invoice.vat_amount],
    ["UKUPNO", invoice.total_amount],
  ];
  const wsHeader = XLSX.utils.aoa_to_sheet(headerData);
  XLSX.utils.book_append_sheet(wb, wsHeader, "Zaglavlje");

  const wsItems = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, wsItems, "Stavke");

  XLSX.writeFile(wb, `Faktura_${invoice.invoice_number.replace(/\//g, "-")}.xlsx`);
}
