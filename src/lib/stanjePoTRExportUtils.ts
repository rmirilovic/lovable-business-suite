import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { formatNumber } from "@/lib/formatting";
import type { StanjePoTRRow } from "@/pages/racunovodstvo/StanjePoTR";

interface ExportMeta {
  companyName: string;
  accountFrom: string;
  accountTo: string;
  yearLabel: string;
}

function fmt(v: number) {
  return formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function exportStanjePoTRToExcel(rows: StanjePoTRRow[], meta: ExportMeta) {
  const data = rows.map((r) => ({
    Konto: r.account_code,
    "Opis konta": r.account_name,
    Analitika: r.analytics || "",
    "Opis analitike": r.analytics_description || "",
    Duguje: r.debit,
    Potražuje: r.credit,
    Stanje: r.balance,
  }));

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  data.push({
    Konto: "UKUPNO",
    "Opis konta": "",
    Analitika: "",
    "Opis analitike": "",
    Duguje: totalDebit,
    Potražuje: totalCredit,
    Stanje: totalDebit - totalCredit,
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 10 }, { wch: 35 }, { wch: 12 }, { wch: 35 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stanje po TR");
  XLSX.writeFile(wb, `stanje_po_tr_${meta.accountFrom}_${meta.accountTo}.xlsx`);
}

async function buildPdf(rows: StanjePoTRRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pw / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Stanje po TR", pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.text(`Konta: ${meta.accountFrom} - ${meta.accountTo}    Godina: ${meta.yearLabel}`, pw / 2, y, { align: "center" });
  y += 6;

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

  const body = rows.map((r) => [
    r.account_code,
    r.account_name,
    r.analytics || "-",
    r.analytics_description || "-",
    fmt(r.debit),
    fmt(r.credit),
    fmt(r.balance),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Konto", "Opis konta", "Analitika", "Opis analitike", "Duguje", "Potražuje", "Stanje"]],
    body,
    foot: [["", "", "", `Ukupno (${rows.length})`, fmt(totalDebit), fmt(totalCredit), fmt(totalDebit - totalCredit)]],
    styles: { font: "DejaVuSans", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 22 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 28, halign: "right" },
    },
  });

  return doc;
}

export async function exportStanjePoTRToPdf(rows: StanjePoTRRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  doc.save(`stanje_po_tr_${meta.accountFrom}_${meta.accountTo}.pdf`);
}

export async function printStanjePoTR(rows: StanjePoTRRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
