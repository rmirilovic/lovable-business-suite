import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { format } from "date-fns";
import { formatDecimal } from "@/lib/formatting";

export interface DnevniRow {
  delivery_number: string;
  classification: string;
  article_code: string;
  article_name: string;
  unit: string;
  launched_qty: number;
  qty_shift_1: number;
  qty_shift_2: number;
  qty_shift_3: number;
  qty_day: number;
  qty_day_kg: number;
  qty_total_to_date: number;
  scrap_kg: number;
}

export interface DnevniLineGroup {
  line_code: number;
  line_name: string;
  shift_manager_1: string;
  shift_manager_2: string;
  shift_manager_3: string;
  rows: DnevniRow[];
  totals: {
    launched: number;
    s1: number;
    s2: number;
    s3: number;
    qty_day: number;
    qty_day_kg: number;
    qty_total_to_date: number;
    scrap_kg: number;
  };
}

export interface DnevniReportData {
  groups: DnevniLineGroup[];
  totalKgWithoutClass08: number;
}

interface ExportMeta {
  companyName: string;
  date: string;
}

const fmtDate = (d: string) => (d ? format(new Date(d), "dd.MM.yyyy") : "");
const fmtQty = (v: number) => (v ? formatDecimal(v, 0) : "-");

const HEADERS = [
  "Linija",
  "Predajnica",
  "Klasa",
  "Šifra GP",
  "Naziv GP",
  "JM",
  "Lansirano",
  "I smena",
  "II smena",
  "III smena",
  "Predato za dan",
  "Predato u kg",
  "Predato ukupno\ndo sada",
  "Predato\nškarta (kg)",
];

function buildAoa(data: DnevniReportData, meta: ExportMeta): (string | number)[][] {
  const rows: (string | number)[][] = [];
  rows.push([`Dnevni izveštaj proizvodnje - ${fmtDate(meta.date)}`]);
  rows.push([]);
  rows.push(HEADERS);

  data.groups.forEach((g) => {
    rows.push([
      `Linija: ${g.line_code} - ${g.line_name}`,
      "",
      "",
      "",
      "",
      "",
      "",
      `Šef I sm: ${g.shift_manager_1 || "-"}`,
      `Šef II sm: ${g.shift_manager_2 || "-"}`,
      `Šef III sm: ${g.shift_manager_3 || "-"}`,
      "",
      "",
      "",
      "",
    ]);
    g.rows.forEach((r) => {
      rows.push([
        g.line_name,
        r.delivery_number,
        r.classification,
        r.article_code,
        r.article_name,
        r.unit,
        Math.round(r.launched_qty),
        Math.round(r.qty_shift_1),
        Math.round(r.qty_shift_2),
        Math.round(r.qty_shift_3),
        Math.round(r.qty_day),
        Math.round(r.qty_day_kg),
        Math.round(r.qty_total_to_date),
        Math.round(r.scrap_kg),
      ]);
    });
    rows.push([
      "",
      "",
      "",
      "",
      `Ukupno za liniju ${g.line_name}`,
      "",
      Math.round(g.totals.launched),
      Math.round(g.totals.s1),
      Math.round(g.totals.s2),
      Math.round(g.totals.s3),
      Math.round(g.totals.qty_day),
      Math.round(g.totals.qty_day_kg),
      Math.round(g.totals.qty_total_to_date),
      Math.round(g.totals.scrap_kg),
    ]);
    rows.push([]);
  });

  rows.push([
    "",
    "",
    "",
    "",
    "Ukupno za dan bez klase 08 (kg):",
    "",
    "",
    "",
    "",
    "",
    "",
    Math.round(data.totalKgWithoutClass08),
    "",
    "",
  ]);
  return rows;
}

export function exportDnevniIzvestajToExcel(data: DnevniReportData, meta: ExportMeta) {
  const ws = XLSX.utils.aoa_to_sheet(buildAoa(data, meta));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dnevni izveštaj");
  XLSX.writeFile(wb, `dnevni_izvestaj_proizvodnje_${meta.date}.xlsx`);
}

async function buildPdf(data: DnevniReportData, meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  configurePdfFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = 12;
  doc.setFontSize(11);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(13);
  doc.text(`Dnevni izveštaj proizvodnje - ${fmtDate(meta.date)}`, pageWidth / 2, y, { align: "center" });
  y += 4;

  const head = [HEADERS];
  const body: any[] = [];

  data.groups.forEach((g) => {
    body.push([
      {
        content: `Linija ${g.line_code} - ${g.line_name}   |   Šef I sm: ${g.shift_manager_1 || "-"}   |   Šef II sm: ${g.shift_manager_2 || "-"}   |   Šef III sm: ${g.shift_manager_3 || "-"}`,
        colSpan: HEADERS.length,
        styles: { fillColor: [200, 220, 240], fontStyle: "bold" },
      },
    ]);
    g.rows.forEach((r) => {
      body.push([
        g.line_name,
        r.delivery_number,
        r.classification,
        r.article_code,
        r.article_name,
        r.unit,
        fmtQty(r.launched_qty),
        fmtQty(r.qty_shift_1),
        fmtQty(r.qty_shift_2),
        fmtQty(r.qty_shift_3),
        fmtQty(r.qty_day),
        fmtQty(r.qty_day_kg),
        fmtQty(r.qty_total_to_date),
        fmtQty(r.scrap_kg),
      ]);
    });
    body.push([
      {
        content: `Ukupno za liniju ${g.line_name}`,
        colSpan: 6,
        styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] },
      },
      { content: fmtQty(g.totals.launched), styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] } },
      { content: fmtQty(g.totals.s1), styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] } },
      { content: fmtQty(g.totals.s2), styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] } },
      { content: fmtQty(g.totals.s3), styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] } },
      { content: fmtQty(g.totals.qty_day), styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] } },
      { content: fmtQty(g.totals.qty_day_kg), styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] } },
      { content: fmtQty(g.totals.qty_total_to_date), styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] } },
      { content: fmtQty(g.totals.scrap_kg), styles: { halign: "right", fontStyle: "bold", fillColor: [230, 230, 230] } },
    ]);
  });

  body.push([
    {
      content: "Ukupno za dan bez klase 08 (kg):",
      colSpan: 11,
      styles: { halign: "right", fontStyle: "bold", fillColor: [180, 200, 220] },
    },
    { content: fmtQty(data.totalKgWithoutClass08), styles: { halign: "right", fontStyle: "bold", fillColor: [180, 200, 220] } },
    { content: "", styles: { fillColor: [180, 200, 220] } },
    { content: "", styles: { fillColor: [180, 200, 220] } },
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 6.5, cellPadding: 1 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold", fontSize: 6.5, halign: "center" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 18 },
      2: { cellWidth: 14 },
      3: { cellWidth: 16 },
      4: { cellWidth: 55 },
      5: { cellWidth: 10 },
      6: { cellWidth: 18, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 18, halign: "right" },
      10: { cellWidth: 20, halign: "right" },
      11: { cellWidth: 20, halign: "right" },
      12: { cellWidth: 16, halign: "right" },
      13: { cellWidth: 16, halign: "right" },
    },
  });

  return doc;
}

export async function exportDnevniIzvestajToPdf(data: DnevniReportData, meta: ExportMeta) {
  const doc = await buildPdf(data, meta);
  doc.save(`dnevni_izvestaj_proizvodnje_${meta.date}.pdf`);
}

export async function printDnevniIzvestaj(data: DnevniReportData, meta: ExportMeta) {
  const doc = await buildPdf(data, meta);
  printPdfBlob(doc.output("blob"));
}
