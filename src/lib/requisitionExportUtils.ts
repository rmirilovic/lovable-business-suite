import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { MaterialRequisition, REQ_STATUS_LABELS } from "@/hooks/useMaterialRequisitions";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function calcValue(r: MaterialRequisition) {
  return r.items?.reduce((s, i) => s + (i.item_value || 0), 0) ?? 0;
}

function mapRows(items: MaterialRequisition[]) {
  return items.map((r) => ({
    "Broj": r.requisition_number,
    "Datum": fmtDate(r.requisition_date),
    "Magacin": r.warehouse ? `${r.warehouse.code} - ${r.warehouse.name}` : "-",
    "Radni nalog": r.work_order?.order_number ?? "-",
    "GP": r.work_order?.work_order_items?.map(i => i.article_code).join(", ") ?? "-",
    "Izdao": r.issued_by || "-",
    "Primio": r.received_by || "-",
    "Vrednost": calcValue(r),
    "Status": REQ_STATUS_LABELS[r.status] ?? r.status,
  }));
}

export function exportRequisitionsToExcel(items: MaterialRequisition[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trebovanja");
  XLSX.writeFile(wb, "trebovanja.xlsx");
}

async function buildPdf(items: MaterialRequisition[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF();
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Trebovanja materijala", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    doc.text(`Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : ""} - ${meta.dateTo ? fmtDate(meta.dateTo) : ""}`, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const head = [["Broj", "Datum", "Magacin", "Radni nalog", "GP", "Izdao", "Primio", "Vrednost", "Status"]];
  const body = items.map((r) => [
    r.requisition_number,
    fmtDate(r.requisition_date),
    r.warehouse ? `${r.warehouse.code} - ${r.warehouse.name}` : "-",
    r.work_order?.order_number ?? "-",
    r.work_order?.work_order_items?.map(i => i.article_code).join(", ") ?? "-",
    r.issued_by || "-",
    r.received_by || "-",
    formatNumber(calcValue(r)),
    REQ_STATUS_LABELS[r.status] ?? r.status,
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold" },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 20 }, 7: { halign: "right", cellWidth: 22 }, 8: { cellWidth: 20 } },
  });

  return doc;
}

export async function exportRequisitionsToPdf(items: MaterialRequisition[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("trebovanja.pdf");
}

export async function printRequisitions(items: MaterialRequisition[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  printPdfBlob(doc.output("blob"));
}
