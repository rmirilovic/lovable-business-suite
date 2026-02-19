import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { ReprocessingWorkOrder, RWO_STATUS_LABELS } from "@/hooks/useReprocessingWorkOrders";
import { format } from "date-fns";
import { formatPrice } from "@/lib/formatting";

export interface EnrichedRWO extends ReprocessingWorkOrder {
  firstProduct: string;
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

function mapRows(orders: EnrichedRWO[]) {
  return orders.map((o) => ({
    "Broj": o.order_number,
    "Datum": fmtDate(o.order_date),
    "Rok": fmtDate(o.deadline_date),
    "Proizvod": o.firstProduct || "-",
    "Magacin": o.warehouse?.code ?? "-",
    "Vrednost": fmtNum(o.totalValue),
    "Status": RWO_STATUS_LABELS[o.status] ?? o.status,
  }));
}

// ── Excel ────────────────────────────────────────────────────────────────────

export function exportRWOToExcel(orders: EnrichedRWO[], _meta: ExportMeta) {
  const data = mapRows(orders);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 10 },
    { wch: 14 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "RN preradu");
  XLSX.writeFile(wb, "rn_preradu.xlsx");
}

// ── PDF (shared builder) ─────────────────────────────────────────────────────

async function buildPdf(orders: EnrichedRWO[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(14);
  doc.text("RN za preradu i doradu", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : ""} - ${meta.dateTo ? fmtDate(meta.dateTo) : ""}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const head = [["Broj", "Datum", "Rok", "Proizvod", "Mag.", "Vrednost", "Status"]];
  const body = orders.map((o) => [
    o.order_number,
    fmtDate(o.order_date),
    fmtDate(o.deadline_date),
    o.firstProduct || "-",
    o.warehouse?.code ?? "-",
    fmtNum(o.totalValue),
    RWO_STATUS_LABELS[o.status] ?? o.status,
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
      2: { cellWidth: 22 },
      4: { cellWidth: 16 },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 20 },
    },
  });

  return doc;
}

// ── PDF download ─────────────────────────────────────────────────────────────

export async function exportRWOToPdf(orders: EnrichedRWO[], meta: ExportMeta) {
  const doc = await buildPdf(orders, meta);
  doc.save("rn_preradu.pdf");
}

// ── Print ────────────────────────────────────────────────────────────────────

export async function printRWO(orders: EnrichedRWO[], meta: ExportMeta) {
  const doc = await buildPdf(orders, meta);
  printPdfBlob(doc.output("blob"));
}
