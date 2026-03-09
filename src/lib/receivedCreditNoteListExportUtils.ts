import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { ReceivedCreditNote } from "@/hooks/useReceivedCreditNotes";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

interface ExportMeta { companyName: string; dateFrom?: string; dateTo?: string; }

const statusLabels: Record<string, string> = { draft: "Nacrt", posted: "Proknjiženo", cancelled: "Stornirano" };
function fmtDate(d: string | null) { return d ? format(new Date(d), "dd.MM.yyyy") : "-"; }

function mapRows(items: ReceivedCreditNote[]) {
  return items.map((d) => ({
    "Interni broj": d.internal_number,
    "Broj dokumenta dobavljača": d.supplier_document_number,
    "Datum dokumenta": fmtDate(d.document_date),
    "Dobavljač": d.supplier_name || d.partner?.name || "-",
    "PIB": d.supplier_pib || "-",
    "PDV obveznik": d.supplier_is_in_pdv ? "Da" : "Ne",
    "Osnovica": d.subtotal,
    "PDV": d.vat_amount,
    "Ukupno": d.total_amount,
    "Status": statusLabels[d.status] ?? d.status,
  }));
}

export function exportReceivedCreditNotesToExcel(items: ReceivedCreditNote[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Primljena KO");
  XLSX.writeFile(wb, "primljena_knjizna_odobrenja.xlsx");
}

async function buildPdf(items: ReceivedCreditNote[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;
  doc.setFontSize(12); doc.text(meta.companyName, pageWidth / 2, y, { align: "center" }); y += 8;
  doc.setFontSize(14); doc.text("Primljena knjižna odobrenja", pageWidth / 2, y, { align: "center" }); y += 6;
  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    doc.text(`Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`, pageWidth / 2, y, { align: "center" });
    y += 6;
  }
  const rows = items.map((d) => [
    d.internal_number, d.supplier_document_number, fmtDate(d.document_date),
    d.supplier_name || d.partner?.name || "-", d.supplier_pib || "-",
    d.supplier_is_in_pdv ? "Da" : "Ne",
    formatNumber(d.subtotal, { minimumFractionDigits: 2 }),
    formatNumber(d.vat_amount, { minimumFractionDigits: 2 }),
    formatNumber(d.total_amount, { minimumFractionDigits: 2 }),
    statusLabels[d.status] ?? d.status,
  ]);
  autoTable(doc, {
    startY: y,
    head: [["Int. broj", "Broj dobavljača", "Datum", "Dobavljač", "PIB", "PDV obv.", "Osnovica", "PDV", "Ukupno", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: { 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
  });
  return doc;
}

export async function exportReceivedCreditNotesToPdf(items: ReceivedCreditNote[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("primljena_knjizna_odobrenja.pdf");
}

export async function printReceivedCreditNotes(items: ReceivedCreditNote[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  printPdfBlob(doc.output("blob"));
}
