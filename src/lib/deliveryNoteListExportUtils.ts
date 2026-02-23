import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { DeliveryNote } from "@/hooks/useDeliveryNotes";
import { format } from "date-fns";

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjižena",
  cancelled: "Stornirana",
};

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function mapRows(items: DeliveryNote[]) {
  return items.map((dn) => ({
    Broj: dn.delivery_number,
    Datum: fmtDate(dn.delivery_date),
    Kupac: dn.partner ? `${dn.partner.code} - ${dn.partner.name}` : "-",
    Magacin: dn.warehouse ? `${dn.warehouse.code} - ${dn.warehouse.name}` : "-",
    Faktura: dn.invoice?.invoice_number || "-",
    Status: statusLabels[dn.status] ?? dn.status,
  }));
}

export function exportDeliveryNotesToExcel(items: DeliveryNote[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 14 }, { wch: 14 }, { wch: 35 }, { wch: 25 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Otpremnice");
  XLSX.writeFile(wb, "otpremnice.xlsx");
}

async function buildPdf(items: DeliveryNote[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Otpremnice", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const rows = items.map((dn) => [
    dn.delivery_number,
    fmtDate(dn.delivery_date),
    dn.partner ? `${dn.partner.code} - ${dn.partner.name}` : "-",
    dn.warehouse ? `${dn.warehouse.code} - ${dn.warehouse.name}` : "-",
    dn.invoice?.invoice_number || "-",
    statusLabels[dn.status] ?? dn.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Broj", "Datum", "Kupac", "Magacin", "Faktura", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  return doc;
}

export async function exportDeliveryNotesToPdf(items: DeliveryNote[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("otpremnice.pdf");
}

export async function printDeliveryNotes(items: DeliveryNote[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
