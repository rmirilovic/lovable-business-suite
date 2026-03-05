import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

interface BankStatementRow {
  id: string;
  statement_number: string;
  statement_date: string;
  total_debit: number;
  total_credit: number;
  status: string;
  bank_accounts?: { code: string; account_number: string; bank_name: string } | null;
}

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjižen",
};

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function mapRows(items: BankStatementRow[]) {
  return items.map((s) => ({
    "Broj": s.statement_number,
    "Datum": fmtDate(s.statement_date),
    "Tekući račun": `${s.bank_accounts?.account_number || ""} - ${s.bank_accounts?.bank_name || ""}`,
    "Duguje": s.total_debit,
    "Potražuje": s.total_credit,
    "Status": statusLabels[s.status] ?? s.status,
  }));
}

export function exportBankStatementsToExcel(items: BankStatementRow[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 16 }, { wch: 14 }, { wch: 35 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Izvodi");
  XLSX.writeFile(wb, "izvodi.xlsx");
}

async function buildPdf(items: BankStatementRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Izvodi", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const rows = items.map((s) => [
    s.statement_number,
    fmtDate(s.statement_date),
    `${s.bank_accounts?.account_number || ""} - ${s.bank_accounts?.bank_name || ""}`,
    formatNumber(s.total_debit, { minimumFractionDigits: 2 }),
    formatNumber(s.total_credit, { minimumFractionDigits: 2 }),
    statusLabels[s.status] ?? s.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Broj", "Datum", "Tekući račun", "Duguje", "Potražuje", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  return doc;
}

export async function exportBankStatementsToPdf(items: BankStatementRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("izvodi.pdf");
}

export async function printBankStatements(items: BankStatementRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
