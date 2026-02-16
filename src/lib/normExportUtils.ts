import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { formatDate } from "@/lib/formatting";
import { printPdfBlob } from "@/lib/printPdf";
import type { MaterialNorm, MaterialNormItem, MaterialNormVariant } from "@/hooks/useMaterialNorms";

/** Format a number showing up to 6 decimal places, trimming trailing zeros */
function fmt(val: number): string {
  if (val === 0) return "0";
  return val.toFixed(6).replace(/\.?0+$/, "");
}

interface NormExportMeta {
  norm: MaterialNorm;
  variant: MaterialNormVariant;
  items: MaterialNormItem[];
}

// ── Excel ───────────────────────────────────────────────────────────────────

export function exportNormToExcel({ norm, variant, items }: NormExportMeta) {
  const data = items.map((item, idx) => ({
    "R.br.": idx + 1,
    "Šifra": item.article_code,
    "Naziv materijala": item.article_name,
    "JM": item.unit,
    "Utrošak / kg": item.qty_per_kg || "",
    "Utrošak / m": item.qty_per_m || "",
    "Utrošak / kom": item.qty_per_pc || "",
  }));

  // Add totals row
  const totalKg = items.reduce((s, i) => s + (i.qty_per_kg ?? 0), 0);
  const totalM = items.reduce((s, i) => s + (i.qty_per_m ?? 0), 0);
  const totalPc = items.reduce((s, i) => s + (i.qty_per_pc ?? 0), 0);

  data.push({
    "R.br.": "" as any,
    "Šifra": "",
    "Naziv materijala": "",
    "JM": "Ukupno:",
    "Utrošak / kg": totalKg || "",
    "Utrošak / m": totalM || "",
    "Utrošak / kom": totalPc || "",
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 6 }, { wch: 12 }, { wch: 35 }, { wch: 6 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Normativ");

  const safeName = `${norm.article_code}_${variant.variant_name}`.replace(/[^a-zA-Z0-9а-яА-ЯёЁa-žA-Ž\s_-]/g, "").trim();
  XLSX.writeFile(wb, `Normativ_${safeName}.xlsx`);
}

// ── PDF ─────────────────────────────────────────────────────────────────────

async function buildNormPdf({ norm, variant, items }: NormExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "portrait" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  // Title
  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Normativ utroška materijala", pageWidth / 2, y, { align: "center" });
  y += 8;

  // GP info
  doc.setFontSize(10);
  doc.setFont("Roboto", "bold");
  doc.text(`Gotov proizvod: ${norm.article_code} - ${norm.article_name}`, 14, y);
  y += 5;
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.text(`JM: ${norm.article_unit || ""}`, 14, y);

  const metaParts: string[] = [];
  if (norm.article_kg_po_jm && norm.article_kg_po_jm > 0) {
    metaParts.push(`Masa kg/JM: ${norm.article_kg_po_jm}`);
  }
  if (norm.article_kol_mas && norm.article_kol_mas > 0) {
    metaParts.push(`Količina za masu: ${norm.article_kol_mas}`);
  }
  if (metaParts.length > 0) {
    doc.text(metaParts.join("    "), 50, y);
  }
  y += 5;

  doc.text(`Varijanta: ${variant.variant_name}`, 14, y);
  const statusText = variant.status === "approved" ? "Odobrena" : "Nacrt";
  doc.text(`Status: ${statusText}`, 100, y);
  y += 5;

  doc.text(`Datum: ${formatDate(norm.updated_at || norm.created_at)}`, 14, y);
  y += 7;

  // Table
  const head = [["R.br.", "Šifra", "Naziv materijala", "JM", "Utrošak / kg", "Utrošak / m", "Utrošak / kom"]];
  const body = items.map((item, idx) => [
    String(idx + 1),
    item.article_code,
    item.article_name,
    item.unit,
    item.qty_per_kg ? fmt(item.qty_per_kg) : "",
    item.qty_per_m ? fmt(item.qty_per_m) : "",
    item.qty_per_pc ? fmt(item.qty_per_pc) : "",
  ]);

  const totalKg = items.reduce((s, i) => s + (i.qty_per_kg ?? 0), 0);
  const totalM = items.reduce((s, i) => s + (i.qty_per_m ?? 0), 0);
  const totalPc = items.reduce((s, i) => s + (i.qty_per_pc ?? 0), 0);

  const foot = [["", "", "", "Ukupno:", totalKg ? fmt(totalKg) : "", totalM ? fmt(totalM) : "", totalPc ? fmt(totalPc) : ""]];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    styles: { font: "Roboto", fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [60, 60, 60], fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: [240, 240, 240], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "left", cellWidth: 22 },
      2: { halign: "left" },
      3: { halign: "center", cellWidth: 12 },
      4: { halign: "right", cellWidth: 25 },
      5: { halign: "right", cellWidth: 25 },
      6: { halign: "right", cellWidth: 25 },
    },
    didParseCell: (data) => {
      if (data.section === "foot" && data.column.index === 3) {
        data.cell.styles.halign = "right";
        data.cell.styles.fontStyle = "bold";
      }
      if (data.section === "foot" && data.column.index >= 4) {
        data.cell.styles.halign = "right";
      }
    },
  });

  return doc;
}

export async function exportNormToPdf(meta: NormExportMeta) {
  const doc = await buildNormPdf(meta);
  const safeName = `${meta.norm.article_code}_${meta.variant.variant_name}`.replace(/[^a-zA-Z0-9а-яА-ЯёЁa-žA-Ž\s_-]/g, "").trim();
  doc.save(`Normativ_${safeName}.pdf`);
}

export async function printNorm(meta: NormExportMeta) {
  const doc = await buildNormPdf(meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
