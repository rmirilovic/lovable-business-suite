import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { PaymentOrder } from "@/hooks/usePaymentOrders";
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
  sent: "Poslat",
  paid: "Plaćen",
};

function fmtDate(d: string | null | undefined) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function mapRows(items: PaymentOrder[]) {
  return items.map((o) => ({
    "Int. dokument": o.source_document_number || "-",
    "Partner": o.partner_name || "-",
    "Datum": fmtDate(o.booking_date),
    "Dok. dobavljača": o.supplier_document_number || "-",
    "Valuta": fmtDate(o.due_date),
    "Iznos dok.": o.document_amount,
    "Plaća se": o.approved_amount,
    "Status": statusLabels[o.status] ?? o.status,
    "Odobren": fmtDate(o.approved_date),
  }));
}

export function exportPaymentOrdersToExcel(items: PaymentOrder[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 16 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Nalozi za plaćanja");
  XLSX.writeFile(wb, "nalozi_za_placanja.xlsx");
}

async function buildPdf(items: PaymentOrder[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Nalozi za plaćanja", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const rows = items.map((o) => [
    o.source_document_number || "-",
    o.partner_name || "-",
    fmtDate(o.booking_date),
    o.supplier_document_number || "-",
    fmtDate(o.due_date),
    formatNumber(o.document_amount, { minimumFractionDigits: 2 }),
    formatNumber(o.approved_amount, { minimumFractionDigits: 2 }),
    statusLabels[o.status] ?? o.status,
    fmtDate(o.approved_date),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Int. dokument", "Partner", "Datum", "Dok. dobavljača", "Valuta", "Iznos dok.", "Plaća se", "Status", "Odobren"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });

  return doc;
}

export async function exportPaymentOrdersToPdf(items: PaymentOrder[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("nalozi_za_placanja.pdf");
}

export async function printPaymentOrders(items: PaymentOrder[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
