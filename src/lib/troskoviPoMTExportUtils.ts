import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { formatNumber } from "@/lib/formatting";
import type { TroskoviPoMTRow } from "@/pages/racunovodstvo/TroskoviPoMT";

const MONTH_FULL = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

interface ExportMeta {
  companyName: string;
  yearLabel: string;
}

function fmt(v: number) {
  return formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function exportTroskoviPoMTToExcel(rows: TroskoviPoMTRow[], meta: ExportMeta) {
  const data = rows.map((r) => {
    const obj: Record<string, string | number> = {
      "Šifra MT": r.orgUnitCode,
      "Naziv MT": r.orgUnitName,
      "Konto": r.accountCode,
      "Opis konta": r.accountName,
    };
    for (let i = 0; i < 12; i++) obj[MONTH_FULL[i]] = r.months[i];
    obj["UKUPNO"] = r.total;
    return obj;
  });

  // Totals row
  const totals: Record<string, string | number> = {
    "Šifra MT": "UKUPNO",
    "Naziv MT": "",
    "Konto": "",
    "Opis konta": "",
  };
  for (let i = 0; i < 12; i++) {
    totals[MONTH_FULL[i]] = rows.reduce((s, r) => s + r.months[i], 0);
  }
  totals["UKUPNO"] = rows.reduce((s, r) => s + r.total, 0);
  data.push(totals);

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 25 },
    ...Array(12).fill({ wch: 14 }),
    { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Troškovi po MT");
  XLSX.writeFile(wb, `troskovi_po_mt_${meta.yearLabel}.xlsx`);
}

async function buildPdf(rows: TroskoviPoMTRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape", format: "a3" });
  configurePdfFonts(doc);

  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pw / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Troškovi po mestima troškova", pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.text(`Godina: ${meta.yearLabel}`, pw / 2, y, { align: "center" });
  y += 6;

  const head = ["Šifra MT", "Naziv MT", "Konto", "Opis konta", ...MONTH_FULL, "UKUPNO"];

  const body = rows.map((r) => [
    r.orgUnitCode,
    r.orgUnitName,
    r.accountCode,
    r.accountName,
    ...r.months.map((v) => v !== 0 ? fmt(v) : "-"),
    fmt(r.total),
  ]);

  const monthTotals = Array(12).fill(0);
  rows.forEach((r) => r.months.forEach((v, i) => (monthTotals[i] += v)));
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  const foot = [
    "", "", "", `Ukupno (${rows.length})`,
    ...monthTotals.map((v: number) => v !== 0 ? fmt(v) : "-"),
    fmt(grandTotal),
  ];

  const colStyles: Record<number, any> = {
    0: { cellWidth: 18 },
    1: { cellWidth: 35 },
    2: { cellWidth: 18 },
    3: { cellWidth: 35 },
  };
  for (let i = 4; i <= 16; i++) {
    colStyles[i] = { cellWidth: 22, halign: "right" };
  }

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    foot: [foot],
    styles: { font: "DejaVuSans", fontSize: 6.5 },
    headStyles: { fillColor: [66, 66, 66], fontSize: 6 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: colStyles,
  });

  return doc;
}

export async function exportTroskoviPoMTPdf(rows: TroskoviPoMTRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  doc.save(`troskovi_po_mt_${meta.yearLabel}.pdf`);
}

export async function printTroskoviPoMT(rows: TroskoviPoMTRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
