import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { WorkOrder, STATUS_LABELS } from "@/hooks/useWorkOrders";
import { format } from "date-fns";

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function mapRows(orders: WorkOrder[]) {
  return orders.map((o) => ({
    "Broj": o.order_number,
    "Datum": fmtDate(o.order_date),
    "Rok": fmtDate(o.deadline_date),
    "Magacin GP": o.warehouse?.name ?? "-",
    "Nalog izdao": o.issued_by || "-",
    "Status": STATUS_LABELS[o.status] ?? o.status,
  }));
}

// ── Excel ────────────────────────────────────────────────────────────────────

export function exportWorkOrdersToExcel(orders: WorkOrder[], meta: ExportMeta) {
  const data = mapRows(orders);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 25 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Radni nalozi");
  XLSX.writeFile(wb, "radni_nalozi.xlsx");
}

// ── PDF (shared builder) ─────────────────────────────────────────────────────

async function buildPdf(orders: WorkOrder[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF();
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(14);
  doc.text("Radni nalozi", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : ""} - ${meta.dateTo ? fmtDate(meta.dateTo) : ""}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const head = [["Broj", "Datum", "Rok", "Magacin GP", "Nalog izdao", "Status"]];
  const body = orders.map((o) => [
    o.order_number,
    fmtDate(o.order_date),
    fmtDate(o.deadline_date),
    o.warehouse?.name ?? "-",
    o.issued_by || "-",
    STATUS_LABELS[o.status] ?? o.status,
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 9 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      5: { cellWidth: 22 },
    },
  });

  return doc;
}

// ── PDF download ─────────────────────────────────────────────────────────────

export async function exportWorkOrdersToPdf(orders: WorkOrder[], meta: ExportMeta) {
  const doc = await buildPdf(orders, meta);
  doc.save("radni_nalozi.pdf");
}

// ── Print ────────────────────────────────────────────────────────────────────

export async function printWorkOrders(orders: WorkOrder[], meta: ExportMeta) {
  const doc = await buildPdf(orders, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
