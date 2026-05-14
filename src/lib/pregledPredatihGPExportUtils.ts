import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { format } from "date-fns";
import { formatDecimal, formatPrice } from "@/lib/formatting";

export interface PregledPredatihGPRow {
  delivery_number: string;
  delivery_date: string;
  work_order_number: string;
  production_line: number;
  classification: string;
  article_code: string;
  article_name: string;
  unit: string;
  launched_qty: number;
  qty_shift_1: number;
  qty_shift_2: number;
  qty_shift_3: number;
  qty_total: number;
  delivered_kg: number;
  item_value: number;
}

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

const fmtDate = (d: string | null) => (d ? format(new Date(d), "dd.MM.yyyy") : "-");
const fmtQty = (v: number) => (v ? formatDecimal(v, 3) : "-");
const fmtVal = (v: number) => (v ? formatPrice(v) : "-");

function mapRows(items: PregledPredatihGPRow[]) {
  return items.map((r) => ({
    "Predajnica": r.delivery_number,
    "Datum": fmtDate(r.delivery_date),
    "RN": r.work_order_number,
    "Linija": r.production_line,
    "Klasa": r.classification,
    "Šifra": r.article_code,
    "Naziv": r.article_name,
    "JM": r.unit,
    "Lansirano": fmtQty(r.launched_qty),
    "I smena": fmtQty(r.qty_shift_1),
    "II smena": fmtQty(r.qty_shift_2),
    "III smena": fmtQty(r.qty_shift_3),
    "Predato ukupno": fmtQty(r.qty_total),
    "Predato kg": fmtQty(r.delivered_kg),
    "Vrednost": fmtVal(r.item_value),
  }));
}

export function exportPregledPredatihGPToExcel(items: PregledPredatihGPRow[], _meta: ExportMeta) {
  const ws = XLSX.utils.json_to_sheet(mapRows(items));
  ws["!cols"] = [
    { wch: 12 }, { wch: 11 }, { wch: 12 }, { wch: 7 }, { wch: 10 },
    { wch: 12 }, { wch: 32 }, { wch: 6 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pregled predatih GP");
  XLSX.writeFile(wb, "pregled_predatih_gp.xlsx");
}

async function buildPdf(items: PregledPredatihGPRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 12;

  doc.setFontSize(11);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(13);
  doc.text("Pregled predatih GP", pageWidth / 2, y, { align: "center" });
  y += 5;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(8);
    doc.text(
      `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : ""} - ${meta.dateTo ? fmtDate(meta.dateTo) : ""}`,
      pageWidth / 2,
      y,
      { align: "center" }
    );
    y += 4;
  }

  const head = [[
    "Predajnica", "Datum", "RN", "Lin.", "Klasa", "Šifra", "Naziv", "JM",
    "Lansirano", "I sm.", "II sm.", "III sm.", "Predato uk.", "Predato kg", "Vrednost",
  ]];
  const body = items.map((r) => [
    r.delivery_number,
    fmtDate(r.delivery_date),
    r.work_order_number,
    String(r.production_line),
    r.classification,
    r.article_code,
    r.article_name,
    r.unit,
    fmtQty(r.launched_qty),
    fmtQty(r.qty_shift_1),
    fmtQty(r.qty_shift_2),
    fmtQty(r.qty_shift_3),
    fmtQty(r.qty_total),
    fmtQty(r.delivered_kg),
    fmtVal(r.item_value),
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 7, cellPadding: 1.2 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold", fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 16 },
      2: { cellWidth: 18 },
      3: { cellWidth: 9, halign: "center" },
      4: { cellWidth: 14 },
      5: { cellWidth: 18 },
      6: { cellWidth: 50 },
      7: { cellWidth: 10 },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 16, halign: "right" },
      10: { cellWidth: 16, halign: "right" },
      11: { cellWidth: 16, halign: "right" },
      12: { cellWidth: 19, halign: "right" },
      13: { cellWidth: 19, halign: "right" },
      14: { cellWidth: 22, halign: "right" },
    },
  });

  return doc;
}

export async function exportPregledPredatihGPToPdf(items: PregledPredatihGPRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("pregled_predatih_gp.pdf");
}

export async function printPregledPredatihGP(items: PregledPredatihGPRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  printPdfBlob(doc.output("blob"));
}
