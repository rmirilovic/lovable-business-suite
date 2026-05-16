import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { format } from "date-fns";
import { formatDecimal } from "@/lib/formatting";

export interface SefSmeneCell {
  s1: number;
  s2: number;
  s3: number;
}
export interface SefSmeneRow {
  date: string; // yyyy-MM-dd
  m1: SefSmeneCell;
  m2: SefSmeneCell;
  m3: SefSmeneCell;
  total: number;
}
export interface SefSmeneReport {
  rows: SefSmeneRow[];
  managerNames: { m1: string; m2: string; m3: string };
  totals: {
    m1: SefSmeneCell;
    m2: SefSmeneCell;
    m3: SefSmeneCell;
    total: number;
  };
}

interface Meta {
  companyName: string;
  dateFrom: string;
  dateTo: string;
}

const fmtDate = (d: string) => (d ? format(new Date(d), "dd.MM.yyyy") : "");
const fmtQty = (v: number) => (v ? formatDecimal(v, 0) : "-");

function mgrTotal(c: SefSmeneCell) {
  return Math.round(c.s1 + c.s2 + c.s3);
}

function headerRows(r: SefSmeneReport): string[][] {
  return [
    [
      "Datum",
      `${r.managerNames.m1 || "Šef 1"}`,
      "",
      "",
      "",
      `${r.managerNames.m2 || "Šef 2"}`,
      "",
      "",
      "",
      `${r.managerNames.m3 || "Šef 3"}`,
      "",
      "",
      "",
      "Ukupno za dan",
    ],
    ["", "I smena", "II smena", "III smena", "Ukupno", "I smena", "II smena", "III smena", "Ukupno", "I smena", "II smena", "III smena", "Ukupno", ""],
  ];
}

function bodyRows(r: SefSmeneReport): (string | number)[][] {
  const rows: (string | number)[][] = r.rows.map((row) => [
    fmtDate(row.date),
    Math.round(row.m1.s1),
    Math.round(row.m1.s2),
    Math.round(row.m1.s3),
    mgrTotal(row.m1),
    Math.round(row.m2.s1),
    Math.round(row.m2.s2),
    Math.round(row.m2.s3),
    mgrTotal(row.m2),
    Math.round(row.m3.s1),
    Math.round(row.m3.s2),
    Math.round(row.m3.s3),
    mgrTotal(row.m3),
    Math.round(row.total),
  ]);
  rows.push([
    "UKUPNO",
    Math.round(r.totals.m1.s1),
    Math.round(r.totals.m1.s2),
    Math.round(r.totals.m1.s3),
    mgrTotal(r.totals.m1),
    Math.round(r.totals.m2.s1),
    Math.round(r.totals.m2.s2),
    Math.round(r.totals.m2.s3),
    mgrTotal(r.totals.m2),
    Math.round(r.totals.m3.s1),
    Math.round(r.totals.m3.s2),
    Math.round(r.totals.m3.s3),
    mgrTotal(r.totals.m3),
    Math.round(r.totals.total),
  ]);
  return rows;
}

export function exportSefoviToExcel(report: SefSmeneReport, meta: Meta) {
  const aoa: (string | number)[][] = [];
  aoa.push([`Izveštaj po šefovima smena: ${fmtDate(meta.dateFrom)} - ${fmtDate(meta.dateTo)}`]);
  aoa.push([]);
  headerRows(report).forEach((h) => aoa.push(h));
  bodyRows(report).forEach((b) => aoa.push(b));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
    { s: { r: 2, c: 4 }, e: { r: 2, c: 6 } },
    { s: { r: 2, c: 7 }, e: { r: 2, c: 9 } },
    { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
    { s: { r: 2, c: 10 }, e: { r: 3, c: 10 } },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Šefovi smena");
  XLSX.writeFile(wb, `izvestaj_sefovi_smena_${meta.dateFrom}_${meta.dateTo}.xlsx`);
}

async function buildPdf(report: SefSmeneReport, meta: Meta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  configurePdfFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 12;
  doc.setFontSize(11);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(13);
  doc.text(
    `Izveštaj po šefovima smena: ${fmtDate(meta.dateFrom)} - ${fmtDate(meta.dateTo)}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 4;

  const head = [
    [
      { content: "Datum", rowSpan: 2, styles: { valign: "middle" as const } },
      { content: report.managerNames.m1 || "Šef 1", colSpan: 3, styles: { halign: "center" as const } },
      { content: report.managerNames.m2 || "Šef 2", colSpan: 3, styles: { halign: "center" as const } },
      { content: report.managerNames.m3 || "Šef 3", colSpan: 3, styles: { halign: "center" as const } },
      { content: "Ukupno\nza dan", rowSpan: 2, styles: { valign: "middle" as const, halign: "right" as const } },
    ],
    ["I smena", "II smena", "III smena", "I smena", "II smena", "III smena", "I smena", "II smena", "III smena"],
  ];

  const body = bodyRows(report).map((r, idx) => {
    const isTotal = idx === report.rows.length;
    return r.map((c, i) => ({
      content: i === 0 ? c : typeof c === "number" ? fmtQty(c as number) : c,
      styles: {
        halign: (i === 0 ? "left" : "right") as "left" | "right",
        fontStyle: (isTotal ? "bold" : "normal") as "bold" | "normal",
        fillColor: isTotal ? [220, 220, 220] : undefined,
      },
    }));
  });

  autoTable(doc, {
    startY: y,
    head: head as any,
    body: body as any,
    styles: { font: "Roboto", fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold", fontSize: 8, halign: "center" },
  });

  return doc;
}

export async function exportSefoviToPdf(report: SefSmeneReport, meta: Meta) {
  const doc = await buildPdf(report, meta);
  doc.save(`izvestaj_sefovi_smena_${meta.dateFrom}_${meta.dateTo}.pdf`);
}

export async function printSefovi(report: SefSmeneReport, meta: Meta) {
  const doc = await buildPdf(report, meta);
  printPdfBlob(doc.output("blob"));
}
