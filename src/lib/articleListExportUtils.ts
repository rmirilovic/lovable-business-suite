import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { formatPrice, formatDecimal } from "@/lib/formatting";
import { printPdfBlob } from "@/lib/printPdf";
import type { Article } from "@/hooks/useArticles";

interface ExportMeta {
  companyName: string;
}

const SVK_LABELS: Record<string, string> = {
  "0": "0 - Usluge",
  "1": "1 - Roba",
  "2": "2 - Repromaterijal",
  "6": "6 - Rezervni delovi",
  "8": "8 - Potrošni materijal",
  "9": "9 - Gotovi proizvodi",
};

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9a-žA-Ž\s_-]/g, "").trim().replace(/\s+/g, "_");
}

// ── Excel ───────────────────────────────────────────────────────────────────

export function exportArticlesToExcel(rows: Article[], meta: ExportMeta) {
  const data = rows.map((a) => ({
    "Šifra": a.code,
    "Naziv": a.name,
    "Klasa": a.article_group ?? "",
    "SVK": a.svk ? SVK_LABELS[a.svk] ?? a.svk : "",
    "JM": a.unit,
    "Nabavna cena": a.purchase_price ?? 0,
    "Prodajna cena": a.selling_price ?? 0,
    "Stanje": a.stock ?? 0,
    "Min. stanje": a.min_stock ?? 0,
    "kg po JM": a.kg_po_jm ?? 0,
    "Status": a.is_active ? "Aktivan" : "Neaktivan",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 40 }, { wch: 12 }, { wch: 22 }, { wch: 6 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Artikli");

  const date = new Date().toISOString().split("T")[0];
  const suffix = meta.companyName ? `_${safeFileName(meta.companyName)}` : "";
  XLSX.writeFile(wb, `Sifarnik_artikala${suffix}_${date}.xlsx`);
}

// ── PDF ─────────────────────────────────────────────────────────────────────

async function buildArticlesPdf(rows: Article[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 12;

  if (meta.companyName) {
    doc.setFontSize(11);
    doc.setFont("Roboto", "bold");
    doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  doc.setFontSize(13);
  doc.setFont("Roboto", "bold");
  doc.text("Šifarnik artikala", pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(8);
  doc.setFont("Roboto", "normal");
  doc.text(`Ukupno: ${rows.length}`, 14, y);
  y += 4;

  const head = [[
    "Šifra", "Naziv", "Klasa", "SVK", "JM",
    "Nab. cena", "Prod. cena", "Stanje", "Min.", "Status",
  ]];

  const body = rows.map((a) => [
    a.code,
    a.name,
    a.article_group ?? "",
    a.svk ?? "",
    a.unit,
    formatPrice(a.purchase_price ?? 0),
    formatPrice(a.selling_price ?? 0),
    formatDecimal(a.stock ?? 0),
    formatDecimal(a.min_stock ?? 0),
    a.is_active ? "Aktivan" : "Neaktivan",
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [60, 60, 60], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "left", cellWidth: 22 },
      1: { halign: "left" },
      2: { halign: "left", cellWidth: 18 },
      3: { halign: "center", cellWidth: 12 },
      4: { halign: "center", cellWidth: 12 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 22 },
      7: { halign: "right", cellWidth: 18 },
      8: { halign: "right", cellWidth: 16 },
      9: { halign: "center", cellWidth: 20 },
    },
  });

  return doc;
}

export async function exportArticlesToPdf(rows: Article[], meta: ExportMeta) {
  const doc = await buildArticlesPdf(rows, meta);
  const date = new Date().toISOString().split("T")[0];
  const suffix = meta.companyName ? `_${safeFileName(meta.companyName)}` : "";
  doc.save(`Sifarnik_artikala${suffix}_${date}.pdf`);
}

export async function printArticles(rows: Article[], meta: ExportMeta) {
  const doc = await buildArticlesPdf(rows, meta);
  printPdfBlob(doc.output("blob"));
}
