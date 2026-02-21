import * as XLSX from "xlsx";
import {
  ServicePurchaseInvoice,
  ServicePurchaseInvoiceItem,
} from "@/hooks/useServicePurchaseInvoices";
import { format } from "date-fns";

const fmtDate = (d: string | null) =>
  d ? format(new Date(d), "dd.MM.yyyy") : "-";

export function exportServicePurchaseInvoiceToExcel(
  invoice: ServicePurchaseInvoice,
  items: ServicePurchaseInvoiceItem[]
) {
  const rows = items.map((item, i) => ({
    "#": i + 1,
    "Šifra": item.item_code || "-",
    "Naziv": item.item_name,
    "MT": item.org_unit?.code || "-",
    "Količina": item.quantity,
    "Cena sa PDV": item.unit_price,
    "PDV %": item.vat_rate,
    "Odb. PDV": item.is_vat_deductible ? "Da" : "Ne",
    "Osnovica": item.line_subtotal,
    "PDV": item.line_vat,
    "Ukupno": item.line_total,
  }));

  const wb = XLSX.utils.book_new();

  // Header info sheet
  const headerData = [
    ["ULAZNA FAKTURA ZA USLUGE"],
    ["Interni broj", invoice.internal_number],
    ["Broj fakture dobavljača", invoice.supplier_invoice_number],
    ["Datum fakture", fmtDate(invoice.invoice_date)],
    ["Datum prijema", fmtDate(invoice.receipt_date)],
    ["Datum valute", fmtDate(invoice.due_date)],
    ["Dobavljač", invoice.supplier_name || invoice.partner?.name || ""],
    ["PIB", invoice.supplier_pib || ""],
    [],
    ["Osnovica", invoice.subtotal],
    ["PDV", invoice.vat_amount],
    ["UKUPNO", invoice.total_amount],
  ];
  const wsHeader = XLSX.utils.aoa_to_sheet(headerData);
  XLSX.utils.book_append_sheet(wb, wsHeader, "Zaglavlje");

  // Items sheet
  const wsItems = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, wsItems, "Stavke");

  XLSX.writeFile(wb, `UFU_${invoice.internal_number.replace(/\//g, "-")}.xlsx`);
}
