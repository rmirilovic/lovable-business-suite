import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { DeliveryOrder } from "@/hooks/useDeliveryOrders";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  approved: "Odobren",
  reserved: "Rezervisan",
  shipped: "Otpremljen",
};

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function mapRows(items: DeliveryOrder[]) {
  return items.map((o) => ({
    "Broj naloga": o.order_number,
    Datum: fmtDate(o.order_date),
    Kupac: o.partner?.name || "-",
    Magacin: o.warehouse ? `${o.warehouse.code} - ${o.warehouse.name}` : "-",
    Ponuda: (o as any).source_quote?.quote_number || "-",
    Otpremnica: (o as any).delivery_note?.delivery_number || "-",
    Status: statusLabels[o.status] ?? o.status,
  }));
}

export function exportDeliveryOrdersToExcel(items: DeliveryOrder[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 16 }, { wch: 14 }, { wch: 30 }, { wch: 25 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Nalozi za isporuku");
  XLSX.writeFile(wb, "nalozi_za_isporuku.xlsx");
}

async function buildPdf(items: DeliveryOrder[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Nalozi za isporuku", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const rows = items.map((o) => [
    o.order_number,
    fmtDate(o.order_date),
    o.partner?.name || "-",
    o.warehouse ? `${o.warehouse.code} - ${o.warehouse.name}` : "-",
    (o as any).source_quote?.quote_number || "-",
    (o as any).delivery_note?.delivery_number || "-",
    statusLabels[o.status] ?? o.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Broj naloga", "Datum", "Kupac", "Magacin", "Ponuda", "Otpremnica", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  return doc;
}

export async function exportDeliveryOrdersToPdf(items: DeliveryOrder[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("nalozi_za_isporuku.pdf");
}

export async function printDeliveryOrders(items: DeliveryOrder[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
