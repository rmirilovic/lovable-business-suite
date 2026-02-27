import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { AdvanceInvoice } from "@/hooks/useAdvanceInvoices";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjižen",
  cancelled: "Storniran",
};

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function fmtNum(n: number) {
  return formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mapRows(items: AdvanceInvoice[]) {
  return items.map((inv) => ({
    Broj: inv.advance_number,
    Datum: fmtDate(inv.advance_date),
    Valuta: fmtDate(inv.due_date),
    Kupac: inv.partner ? `${inv.partner.code} - ${inv.partner.name}` : (inv.partner_name || "-"),
    Iznos: fmtNum(inv.total_amount),
    Status: statusLabels[inv.status] ?? inv.status,
  }));
}

export function exportAdvanceInvoicesToExcel(items: AdvanceInvoice[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 35 }, { wch: 16 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Avansni računi");
  XLSX.writeFile(wb, "avansni_racuni.xlsx");
}

async function buildPdf(items: AdvanceInvoice[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Avansni računi", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const rows = items.map((inv) => [
    inv.advance_number,
    fmtDate(inv.advance_date),
    fmtDate(inv.due_date),
    inv.partner ? `${inv.partner.code} - ${inv.partner.name}` : (inv.partner_name || "-"),
    fmtNum(inv.total_amount),
    statusLabels[inv.status] ?? inv.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Broj", "Datum", "Valuta", "Kupac", "Iznos", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: { 4: { halign: "right" } },
  });

  return doc;
}

export async function exportAdvanceInvoicesToPdf(items: AdvanceInvoice[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("avansni_racuni.pdf");
}

export async function printAdvanceInvoices(items: AdvanceInvoice[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
