import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { formatDecimal, formatDate } from "@/lib/formatting";
import type { InventoryCountItem } from "@/hooks/useInventoryCounts";
import { printPdfBlob } from "@/lib/printPdf";

interface ExportMeta {
  countNumber: string;
  warehouseName: string;
  countDate: string;
}

interface Totals {
  surplusValue: number;
  deficitValue: number;
}

// ── Full PDF ─────────────────────────────────────────────────────────

async function buildFullPdf(rows: InventoryCountItem[], meta: ExportMeta, totals: Totals): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;
  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Popisna lista", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  doc.text(`Broj: ${meta.countNumber}`, 14, y);
  y += 5;
  doc.text(`Magacin: ${meta.warehouseName}`, 14, y);
  y += 5;
  doc.text(`Datum popisa: ${formatDate(meta.countDate)}`, 14, y);
  y += 7;

  const head = [["Šifra", "Naziv", "JM", "Knjižna kol.", "Popisana kol.", "Višak", "Manjak", "Cena", "Vr. viška", "Vr. manjka"]];
  const body = rows.map((r) => [
    r.item_code || "", r.item_name, r.unit,
    formatDecimal(r.book_quantity, 2), formatDecimal(r.counted_quantity, 2),
    r.surplus_qty > 0 ? formatDecimal(r.surplus_qty, 2) : "",
    r.deficit_qty > 0 ? formatDecimal(r.deficit_qty, 2) : "",
    formatDecimal(r.price, 2),
    r.surplus_value > 0 ? formatDecimal(r.surplus_value, 2) : "",
    r.deficit_value > 0 ? formatDecimal(r.deficit_value, 2) : "",
  ]);
  const foot = [["", "", "", "", "", "", "", "Ukupno:", formatDecimal(totals.surplusValue, 2), formatDecimal(totals.deficitValue, 2)]];

  autoTable(doc, {
    startY: y, head, body, foot,
    styles: { font: "Roboto", fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [60, 60, 60], fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: [240, 240, 240], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "left" }, 1: { halign: "left" }, 2: { halign: "center" },
      3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" },
      6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" }, 9: { halign: "right" },
    },
    didParseCell(data) { if (data.section === "foot") data.cell.styles.halign = "right"; },
  });
  return doc;
}

export async function exportInventoryCountPdf(rows: InventoryCountItem[], meta: ExportMeta, totals: Totals) {
  const doc = await buildFullPdf(rows, meta, totals);
  doc.save(`Popis_${meta.countNumber}.pdf`);
}

export async function printInventoryCount(rows: InventoryCountItem[], meta: ExportMeta, totals: Totals) {
  const doc = await buildFullPdf(rows, meta, totals);
  printPdfBlob(doc.output("blob"));
}

// ── Blank PDF (šifra, naziv, JM + prazne kolone) ─────────────────────

async function buildBlankPdf(rows: InventoryCountItem[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "portrait" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;
  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Popisna lista", pageWidth / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  doc.text(`Broj: ${meta.countNumber}`, 14, y);
  y += 5;
  doc.text(`Magacin: ${meta.warehouseName}`, 14, y);
  y += 5;
  doc.text(`Datum popisa: ${formatDate(meta.countDate)}`, 14, y);
  y += 7;

  const head = [["Šifra", "Naziv", "JM", "Popisana kol.", "Cena", "Vrednost"]];
  const body = rows.map((r) => [r.item_code || "", r.item_name, r.unit, "", "", ""]);

  autoTable(doc, {
    startY: y, head, body,
    styles: { font: "Roboto", fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [60, 60, 60], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "left" }, 1: { halign: "left" }, 2: { halign: "center" },
      3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" },
    },
  });
  return doc;
}

export async function exportInventoryCountBlankPdf(rows: InventoryCountItem[], meta: ExportMeta) {
  const doc = await buildBlankPdf(rows, meta);
  doc.save(`Popis_blanko_${meta.countNumber}.pdf`);
}

export async function printInventoryCountBlank(rows: InventoryCountItem[], meta: ExportMeta) {
  const doc = await buildBlankPdf(rows, meta);
  printPdfBlob(doc.output("blob"));
}

// ── Full Excel ───────────────────────────────────────────────────────

export function exportInventoryCountToExcel(rows: InventoryCountItem[], meta: ExportMeta, totals: Totals) {
  const data = rows.map((r) => ({
    "Šifra": r.item_code || "",
    "Naziv": r.item_name,
    "JM": r.unit,
    "Knjižna kol.": r.book_quantity,
    "Popisana kol.": r.counted_quantity,
    "Višak": r.surplus_qty > 0 ? r.surplus_qty : "",
    "Manjak": r.deficit_qty > 0 ? r.deficit_qty : "",
    "Cena": r.price,
    "Vr. viška": r.surplus_value > 0 ? r.surplus_value : "",
    "Vr. manjka": r.deficit_value > 0 ? r.deficit_value : "",
  }));
  data.push({
    "Šifra": "", "Naziv": "", "JM": "", "Knjižna kol.": "" as any,
    "Popisana kol.": "" as any, "Višak": "" as any, "Manjak": "" as any,
    "Cena": "UKUPNO:" as any,
    "Vr. viška": totals.surplusValue,
    "Vr. manjka": totals.deficitValue,
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 35 }, { wch: 6 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Popis");
  XLSX.writeFile(wb, `Popis_${meta.countNumber}.xlsx`);
}

// ── Blank Excel ──────────────────────────────────────────────────────

export function exportInventoryCountBlankToExcel(rows: InventoryCountItem[], meta: ExportMeta) {
  const data = rows.map((r) => ({
    "Šifra": r.item_code || "",
    "Naziv": r.item_name,
    "JM": r.unit,
    "Popisana kol.": "",
    "Cena": "",
    "Vrednost": "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 12 }, { wch: 35 }, { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Popis blanko");
  XLSX.writeFile(wb, `Popis_blanko_${meta.countNumber}.xlsx`);
}
