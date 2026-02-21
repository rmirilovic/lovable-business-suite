import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { GoodsPurchaseInvoice } from "@/hooks/useGoodsPurchaseInvoices";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjiženo",
  cancelled: "Stornirano",
};

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function mapRows(items: GoodsPurchaseInvoice[]) {
  return items.map((inv) => ({
    "Interni broj": inv.internal_number,
    "Broj dobavljača": inv.supplier_invoice_number,
    "Datum fakture": fmtDate(inv.invoice_date),
    "Dobavljač": inv.supplier_name || inv.partner?.name || "-",
    "PIB": inv.supplier_pib || "-",
    "Magacin": inv.warehouse ? `${inv.warehouse.code} - ${inv.warehouse.name}` : "-",
    "Osnovica": inv.subtotal,
    "PDV": inv.vat_amount,
    "Ukupno": inv.total_amount,
    "Status": statusLabels[inv.status] ?? inv.status,
  }));
}

export function exportGoodsPurchaseInvoicesToExcel(items: GoodsPurchaseInvoice[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 14 },
    { wch: 25 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "UF Roba");
  XLSX.writeFile(wb, "ulazne_fakture_roba.xlsx");
}

async function buildPdf(items: GoodsPurchaseInvoice[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Ulazne fakture za robu", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const rows = items.map((inv) => [
    inv.internal_number,
    inv.supplier_invoice_number,
    fmtDate(inv.invoice_date),
    inv.supplier_name || inv.partner?.name || "-",
    inv.warehouse ? inv.warehouse.code : "-",
    formatNumber(inv.subtotal, { minimumFractionDigits: 2 }),
    formatNumber(inv.vat_amount, { minimumFractionDigits: 2 }),
    formatNumber(inv.total_amount, { minimumFractionDigits: 2 }),
    statusLabels[inv.status] ?? inv.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Int. broj", "Broj dobavljača", "Datum", "Dobavljač", "Magacin", "Osnovica", "PDV", "Ukupno", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
  });

  return doc;
}

export async function exportGoodsPurchaseInvoicesToPdf(items: GoodsPurchaseInvoice[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("ulazne_fakture_roba.pdf");
}

export async function printGoodsPurchaseInvoices(items: GoodsPurchaseInvoice[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
