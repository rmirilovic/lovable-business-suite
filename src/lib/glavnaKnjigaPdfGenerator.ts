import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { configurePdfFonts, initializePdfFonts } from "./pdfFonts";
import { formatPrice } from "./formatting";
import { format } from "date-fns";

interface GLRow {
  entry_date: string;
  document_date: string | null;
  item_document_date: string | null;
  entry_number: string;
  account_code: string;
  analytics: string | null;
  description: string;
  item_description: string | null;
  debit_amount: number;
  credit_amount: number;
  balance: number;
}

interface GLPdfOptions {
  rows: GLRow[];
  companyName?: string;
  accountCode?: string;
  accountName?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function generateGlavnaKnjigaPdf(options: GLPdfOptions) {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  doc.setFontSize(14);
  doc.text("Glavna knjiga", 14, 15);

  let y = 15;
  if (options.companyName) {
    doc.setFontSize(10);
    y += 7;
    doc.text(options.companyName, 14, y);
  }

  doc.setFontSize(9);
  y += 6;
  const meta: string[] = [];
  if (options.accountCode) meta.push(`Konto: ${options.accountCode}${options.accountName ? " - " + options.accountName : ""}`);
  if (options.dateFrom) meta.push(`Od: ${format(new Date(options.dateFrom), "dd.MM.yyyy")}`);
  if (options.dateTo) meta.push(`Do: ${format(new Date(options.dateTo), "dd.MM.yyyy")}`);
  if (meta.length) {
    doc.text(meta.join("   |   "), 14, y);
    y += 5;
  }
  doc.text(`Datum štampe: ${format(new Date(), "dd.MM.yyyy")}`, 14, y);
  y += 4;

  const tableData = options.rows.map((r) => [
    format(new Date(r.entry_date), "dd.MM.yyyy"),
    r.item_document_date
      ? format(new Date(r.item_document_date), "dd.MM.yyyy")
      : r.document_date
        ? format(new Date(r.document_date), "dd.MM.yyyy")
        : "-",
    r.entry_number,
    r.account_code,
    r.analytics || "-",
    r.item_description ? `${r.description}\n${r.item_description}` : r.description,
    r.debit_amount !== 0 ? formatPrice(r.debit_amount) : "",
    r.credit_amount !== 0 ? formatPrice(r.credit_amount) : "",
    formatPrice(r.balance),
  ]);

  const totalDebit = options.rows.reduce((s, r) => s + r.debit_amount, 0);
  const totalCredit = options.rows.reduce((s, r) => s + r.credit_amount, 0);

  autoTable(doc, {
    startY: y,
    head: [["Datum", "Valuta", "Nalog", "Konto", "Analitika", "Opis", "Duguje", "Potražuje", "Saldo"]],
    body: tableData,
    foot: [["", "", "", "", "", `Ukupno (${options.rows.length})`, formatPrice(totalDebit), formatPrice(totalCredit), formatPrice(totalDebit - totalCredit)]],
    styles: { font: "DejaVuSans", fontSize: 7 },
    headStyles: { fillColor: [41, 128, 185] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: "auto" },
      6: { cellWidth: 28, halign: "right" },
      7: { cellWidth: 28, halign: "right" },
      8: { cellWidth: 28, halign: "right" },
    },
  });

  return doc;
}
