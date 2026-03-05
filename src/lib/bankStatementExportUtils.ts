import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { BankStatement, BankStatementItem } from "@/hooks/useBankStatements";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

interface ExportData {
  statement: BankStatement & { bank_accounts?: { code: string; account_number: string; bank_name: string } | null };
  items: BankStatementItem[];
  companyName: string;
}

function mapItemRows(items: BankStatementItem[]) {
  return items.map((item, idx) => ({
    "R.br.": idx + 1,
    "Šifra plaćanja": item.payment_code ? `${item.payment_code} - ${item.payment_name}` : "-",
    "Partner": item.partner_name ? `[${item.partner_code}] ${item.partner_name}` : "-",
    "TR partnera": item.partner_account_number || "-",
    "Analitika": item.cost_center_code || "-",
    "Dokument": item.document_reference || "-",
    "Isplata (D)": item.debit_amount,
    "Uplata (P)": item.credit_amount,
  }));
}

export function exportBankStatementToExcel({ statement, items, companyName }: ExportData) {
  const data = mapItemRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 6 }, { wch: 30 }, { wch: 30 }, { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Izvod");
  XLSX.writeFile(wb, `izvod_${statement.statement_number}.xlsx`);
}

async function buildPdf({ statement, items, companyName }: ExportData): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text(`Izvod ${statement.statement_number}`, pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(9);
  const bankInfo = statement.bank_accounts
    ? `${statement.bank_accounts.account_number} - ${statement.bank_accounts.bank_name}`
    : "";
  doc.text(`Datum: ${fmtDate(statement.statement_date)}    Tekući račun: ${bankInfo}`, pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text(
    `Prethodno stanje: ${formatNumber(statement.opening_balance, { minimumFractionDigits: 2 })}`,
    pageWidth / 2, y, { align: "center" }
  );
  y += 6;

  const totalDebit = items.reduce((s, i) => s + Number(i.debit_amount), 0);
  const totalCredit = items.reduce((s, i) => s + Number(i.credit_amount), 0);

  const rows = items.map((item, idx) => [
    String(idx + 1),
    item.payment_code ? `${item.payment_code} - ${item.payment_name}` : "-",
    item.partner_name ? `[${item.partner_code}] ${item.partner_name}` : "-",
    item.partner_account_number || "-",
    item.cost_center_code || "-",
    item.document_reference || "-",
    Number(item.debit_amount) !== 0 ? formatNumber(item.debit_amount, { minimumFractionDigits: 2 }) : "",
    Number(item.credit_amount) !== 0 ? formatNumber(item.credit_amount, { minimumFractionDigits: 2 }) : "",
  ]);

  rows.push([
    "", "", "", "", "", "Ukupno:",
    formatNumber(totalDebit, { minimumFractionDigits: 2 }),
    formatNumber(totalCredit, { minimumFractionDigits: 2 }),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["R.br.", "Šifra plaćanja", "Partner", "TR partnera", "Analitika", "Dokument", "Isplata (D)", "Uplata (P)"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      6: { halign: "right" },
      7: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === rows.length - 1) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return doc;
}

export async function exportBankStatementPdf(data: ExportData) {
  const doc = await buildPdf(data);
  doc.save(`izvod_${data.statement.statement_number}.pdf`);
}

export async function printBankStatement(data: ExportData) {
  const doc = await buildPdf(data);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
