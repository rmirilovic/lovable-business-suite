import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { OutgoingMail, DOCUMENT_TYPE_MAP, STATUS_LABELS } from "@/hooks/useOutgoingMail";
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

function mapRows(items: OutgoingMail[]) {
  return items.map((m) => ({
    "Broj": m.mail_number,
    "Datum dok.": fmtDate(m.document_date),
    "Vrsta": DOCUMENT_TYPE_MAP[m.document_type]?.label || m.document_type,
    "Broj dokumenta": m.document_number,
    "Primalac": m.recipient_name,
    "Adresa": m.recipient_address || "-",
    "Iznos": m.amount != null ? m.amount : "",
    "Status": STATUS_LABELS[m.status] ?? m.status,
  }));
}

export function exportOutgoingMailToExcel(items: OutgoingMail[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 40 },
    { wch: 30 }, { wch: 14 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Poslata pošta");
  XLSX.writeFile(wb, "poslata_posta.xlsx");
}

async function buildPdf(items: OutgoingMail[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Poslata pošta", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const rows = items.map((m) => [
    m.mail_number,
    fmtDate(m.document_date),
    DOCUMENT_TYPE_MAP[m.document_type]?.label || m.document_type,
    m.document_number,
    m.recipient_name,
    m.amount != null ? formatNumber(m.amount, { minimumFractionDigits: 2 }) : "-",
    STATUS_LABELS[m.status] ?? m.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Broj", "Datum", "Vrsta", "Br. dokumenta", "Primalac", "Iznos", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      5: { halign: "right" },
    },
  });

  return doc;
}

export async function exportOutgoingMailToPdf(items: OutgoingMail[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("poslata_posta.pdf");
}

export async function printOutgoingMail(items: OutgoingMail[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
