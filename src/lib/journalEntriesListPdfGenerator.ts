import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { configurePdfFonts, initializePdfFonts } from "./pdfFonts";
import { formatPrice } from "./formatting";
import { format } from "date-fns";

interface JournalEntryRow {
  entry_number: string;
  entry_date: string;
  description: string;
  document_number: string | null;
  total_debit: number;
  total_credit: number;
  status: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjižen",
  cancelled: "Storniran",
};

export async function generateJournalEntriesListPdf(
  entries: JournalEntryRow[],
  companyName?: string
) {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  doc.setFontSize(14);
  doc.text("Nalozi za knjiženje", 14, 15);

  if (companyName) {
    doc.setFontSize(10);
    doc.text(companyName, 14, 22);
  }

  doc.setFontSize(9);
  doc.text(`Datum štampe: ${format(new Date(), "dd.MM.yyyy")}`, 14, companyName ? 28 : 22);

  const tableData = entries.map((e) => [
    e.entry_number,
    format(new Date(e.entry_date), "dd.MM.yyyy"),
    e.description,
    e.document_number || "-",
    formatPrice(e.total_debit),
    formatPrice(e.total_credit),
    STATUS_LABELS[e.status] || e.status,
  ]);

  const totalDebit = entries.reduce((s, e) => s + (e.total_debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.total_credit || 0), 0);

  autoTable(doc, {
    startY: companyName ? 32 : 26,
    head: [["Broj", "Datum", "Opis", "Dokument", "Duguje", "Potražuje", "Status"]],
    body: tableData,
    foot: [["", "", `Ukupno (${entries.length})`, "", formatPrice(totalDebit), formatPrice(totalCredit), ""]],
    styles: { font: "DejaVuSans", fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 25 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 30 },
      4: { cellWidth: 30, halign: "right" },
      5: { cellWidth: 30, halign: "right" },
      6: { cellWidth: 25 },
    },
  });

  return doc;
}
