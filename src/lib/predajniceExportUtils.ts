import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { ProductionDeliveryNote, PDN_STATUS_LABELS } from "@/hooks/useProductionDeliveryNotes";
import { format } from "date-fns";
import { formatPrice } from "@/lib/formatting";

export interface PredajnicaExportRow extends ProductionDeliveryNote {
  firstArticle: string;
  totalKg: number;
  totalValue: number;
}

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function fmtNum(v: number) {
  return v ? formatPrice(v) : "-";
}

function mapRows(items: PredajnicaExportRow[]) {
  return items.map((n) => ({
    "Broj": n.delivery_number,
    "Datum": fmtDate(n.delivery_date),
    "RN": n.work_order?.order_number ?? "-",
    "Magacin": n.warehouse?.code ?? "-",
    "Linija": n.production_line,
    "Gotov proizvod": n.firstArticle || "-",
    "Ukupno kg": fmtNum(n.totalKg),
    "Vrednost": fmtNum(n.totalValue),
    "Status": PDN_STATUS_LABELS[n.status] ?? n.status,
  }));
}

// ── Excel ────────────────────────────────────────────────────────────────────

export function exportPredajniceToExcel(items: PredajnicaExportRow[], _meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
    { wch: 35 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Predajnice GP");
  XLSX.writeFile(wb, "predajnice_gp.xlsx");
}

// ── PDF (shared builder) ─────────────────────────────────────────────────────

async function buildPdf(items: PredajnicaExportRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(14);
  doc.text("Predajnice GP iz proizvodnje", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : ""} - ${meta.dateTo ? fmtDate(meta.dateTo) : ""}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const head = [["Broj", "Datum", "RN", "Mag.", "Linija", "Gotov proizvod", "Ukupno kg", "Vrednost", "Status"]];
  const body = items.map((n) => [
    n.delivery_number,
    fmtDate(n.delivery_date),
    n.work_order?.order_number ?? "-",
    n.warehouse?.code ?? "-",
    String(n.production_line),
    n.firstArticle || "-",
    fmtNum(n.totalKg),
    fmtNum(n.totalValue),
    PDN_STATUS_LABELS[n.status] ?? n.status,
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold" },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 22 },
      2: { cellWidth: 18 },
      3: { cellWidth: 16 },
      4: { cellWidth: 14 },
      6: { cellWidth: 24, halign: "right" },
      7: { cellWidth: 24, halign: "right" },
      8: { cellWidth: 20 },
    },
  });

  return doc;
}

// ── PDF download ─────────────────────────────────────────────────────────────

export async function exportPredajniceToPdf(items: PredajnicaExportRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("predajnice_gp.pdf");
}

// ── Print ────────────────────────────────────────────────────────────────────

export async function printPredajnice(items: PredajnicaExportRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  printPdfBlob(doc.output("blob"));
}
