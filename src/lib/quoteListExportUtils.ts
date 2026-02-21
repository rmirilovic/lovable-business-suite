import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { Quote } from "@/hooks/useQuotes";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  approved: "Odobrena",
  posted: "Potvrđena",
  cancelled: "Stornirana",
};

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function mapRows(items: Quote[]) {
  return items.map((q) => ({
    "Broj ponude": q.quote_number,
    "Datum": fmtDate(q.quote_date),
    "Kupac": q.partner_name || q.partner?.name || "-",
    "Važi do": fmtDate(q.valid_until),
    "Osnovica": q.subtotal,
    "PDV": q.vat_amount,
    "Ukupno": q.total_amount,
    "Status": statusLabels[q.status] ?? q.status,
  }));
}

export function exportQuotesToExcel(items: Quote[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ponude");
  XLSX.writeFile(wb, "ponude.xlsx");
}

async function buildPdf(items: Quote[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Ponude", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const rows = items.map((q) => [
    q.quote_number,
    fmtDate(q.quote_date),
    q.partner_name || q.partner?.name || "-",
    fmtDate(q.valid_until),
    formatNumber(q.subtotal, { minimumFractionDigits: 2 }),
    formatNumber(q.vat_amount, { minimumFractionDigits: 2 }),
    formatNumber(q.total_amount, { minimumFractionDigits: 2 }),
    statusLabels[q.status] ?? q.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Broj ponude", "Datum", "Kupac", "Važi do", "Osnovica", "PDV", "Ukupno", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });

  return doc;
}

export async function exportQuotesToPdf(items: Quote[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("ponude.pdf");
}

export async function printQuotes(items: Quote[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
