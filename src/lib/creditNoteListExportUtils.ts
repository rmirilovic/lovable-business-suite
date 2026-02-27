import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { CreditNote } from "@/hooks/useCreditNotes";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjiženo",
  cancelled: "Stornirano",
};

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function fmtNum(n: number) {
  return formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mapRows(items: CreditNote[]) {
  return items.map((cn) => ({
    Broj: cn.credit_note_number,
    Datum: fmtDate(cn.credit_note_date),
    Kupac: cn.partner ? `${cn.partner.code} - ${cn.partner.name}` : (cn.partner_name || "-"),
    "Ref. faktura": cn.billing_reference_number || "-",
    Iznos: fmtNum(cn.total_amount),
    Status: statusLabels[cn.status] ?? cn.status,
  }));
}

export function exportCreditNotesToExcel(items: CreditNote[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 14 }, { wch: 14 }, { wch: 35 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Knjižna odobrenja");
  XLSX.writeFile(wb, "knjizna_odobrenja.xlsx");
}

async function buildPdf(items: CreditNote[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Knjižna odobrenja", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const rows = items.map((cn) => [
    cn.credit_note_number,
    fmtDate(cn.credit_note_date),
    cn.partner ? `${cn.partner.code} - ${cn.partner.name}` : (cn.partner_name || "-"),
    cn.billing_reference_number || "-",
    fmtNum(cn.total_amount),
    statusLabels[cn.status] ?? cn.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Broj", "Datum", "Kupac", "Ref. faktura", "Iznos", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: { 4: { halign: "right" } },
  });

  return doc;
}

export async function exportCreditNotesToPdf(items: CreditNote[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("knjizna_odobrenja.pdf");
}

export async function printCreditNotes(items: CreditNote[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
