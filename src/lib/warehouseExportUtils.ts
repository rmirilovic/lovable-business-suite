import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { formatPrice, formatDecimal, formatDate } from "@/lib/formatting";
import type { WarehouseStockRow, ArticleMovementRow } from "@/hooks/useWarehouseStock";

// ── Helpers ──────────────────────────────────────────────────────────────────

function printPdfBlob(blob: Blob) {
  const blobUrl = URL.createObjectURL(blob);
  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "none";
  printFrame.src = blobUrl;

  printFrame.onload = () => {
    setTimeout(() => {
      printFrame.contentWindow?.print();
    }, 100);
  };

  document.body.appendChild(printFrame);
  setTimeout(() => {
    document.body.removeChild(printFrame);
    URL.revokeObjectURL(blobUrl);
  }, 60000);
}

interface StockExportMeta {
  warehouseName: string;
  dateFrom?: string;
  dateTo?: string;
}

interface CardExportMeta {
  articleCode: string;
  articleName: string;
  unit: string;
  warehouseName: string;
  dateFrom?: string;
  dateTo?: string;
}

// ── Stanje magacina ─ Excel ─────────────────────────────────────────────────

export function exportStockToExcel(
  rows: WarehouseStockRow[],
  meta: StockExportMeta
) {
  const data = rows.map((r) => ({
    "Šifra": r.article_code,
    "Naziv artikla": r.article_name,
    "JM": r.unit,
    "Ulaz kol.": r.total_in_qty,
    "Duguje": r.total_in_value,
    "Izlaz kol.": r.total_out_qty,
    "Potražuje": r.total_out_value,
    "Stanje kol.": r.balance_qty,
    "Saldo": r.balance_value,
    "Cena": r.balance_qty !== 0 ? Math.round((r.balance_value / r.balance_qty) * 100) / 100 : 0,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const colWidths = [
    { wch: 12 }, { wch: 35 }, { wch: 6 },
    { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
  ];
  ws["!cols"] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stanje magacina");

  const safeName = meta.warehouseName.replace(/[^a-zA-Z0-9а-яА-ЯёЁa-žA-Ž\s_-]/g, "").trim();
  XLSX.writeFile(wb, `Stanje_magacina_${safeName}.xlsx`);
}

// ── Stanje magacina ─ PDF ───────────────────────────────────────────────────

async function buildStockPdf(
  rows: WarehouseStockRow[],
  meta: StockExportMeta,
  totals: { totalInValue: number; totalOutValue: number; balanceValue: number }
): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Stanje magacina", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  doc.text(`Magacin: ${meta.warehouseName}`, 14, y);
  if (meta.dateFrom || meta.dateTo) {
    y += 5;
    doc.text(
      `Period: ${meta.dateFrom ? formatDate(meta.dateFrom) : "—"} do ${meta.dateTo ? formatDate(meta.dateTo) : "—"}`,
      14, y
    );
  }
  y += 7;

  const head = [["Šifra", "Naziv artikla", "JM", "Ulaz kol.", "Duguje", "Izlaz kol.", "Potražuje", "Stanje kol.", "Saldo", "Cena"]];
  const body = rows.map((r) => [
    r.article_code,
    r.article_name,
    r.unit,
    formatDecimal(r.total_in_qty),
    formatPrice(r.total_in_value),
    formatDecimal(r.total_out_qty),
    formatPrice(r.total_out_value),
    formatDecimal(r.balance_qty),
    formatPrice(r.balance_value),
    r.balance_qty !== 0 ? formatPrice(r.balance_value / r.balance_qty) : "—",
  ]);

  const foot = [["", "", "", "", formatPrice(totals.totalInValue), "", formatPrice(totals.totalOutValue), "", formatPrice(totals.balanceValue), ""]];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    styles: { font: "Roboto", fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [60, 60, 60], fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: [240, 240, 240], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "left" },
      2: { halign: "center" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
    didParseCell(data) {
      if (data.section === "foot") {
        data.cell.styles.halign = "right";
      }
    },
  });

  return doc;
}

export async function exportStockToPdf(
  rows: WarehouseStockRow[],
  meta: StockExportMeta,
  totals: { totalInValue: number; totalOutValue: number; balanceValue: number }
) {
  const doc = await buildStockPdf(rows, meta, totals);
  const safeName = meta.warehouseName.replace(/[^a-zA-Z0-9а-яА-ЯёЁa-žA-Ž\s_-]/g, "").trim();
  doc.save(`Stanje_magacina_${safeName}.pdf`);
}

export async function printStock(
  rows: WarehouseStockRow[],
  meta: StockExportMeta,
  totals: { totalInValue: number; totalOutValue: number; balanceValue: number }
) {
  const doc = await buildStockPdf(rows, meta, totals);
  printPdfBlob(doc.output("blob"));
}

// ── Robna kartica ─ Excel ───────────────────────────────────────────────────

interface CardRow extends ArticleMovementRow {
  running_qty: number;
  running_value: number;
}

export function exportCardToExcel(
  rows: CardRow[],
  meta: CardExportMeta,
  totals: { debit: number; credit: number; balanceQty: number; balanceValue: number }
) {
  const data = rows.map((r) => ({
    "Datum": formatDate(r.movement_date),
    "Dokument": `${r.document_type} ${r.document_number}`,
    "Partner": r.partner_name,
    "Ulaz": r.in_quantity > 0 ? r.in_quantity : "",
    "Izlaz": r.out_quantity > 0 ? r.out_quantity : "",
    "Cena": r.unit_price,
    "Duguje": r.debit_value > 0 ? r.debit_value : "",
    "Potražuje": r.credit_value > 0 ? r.credit_value : "",
    "Stanje": r.running_qty,
    "Saldo": r.running_value,
  }));

  // Add totals row
  data.push({
    "Datum": "",
    "Dokument": "UKUPNO:",
    "Partner": "",
    "Ulaz": "" as any,
    "Izlaz": "" as any,
    "Cena": "" as any,
    "Duguje": totals.debit,
    "Potražuje": totals.credit,
    "Stanje": totals.balanceQty,
    "Saldo": totals.balanceValue,
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 24 }, { wch: 30 },
    { wch: 10 }, { wch: 10 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Robna kartica");
  XLSX.writeFile(wb, `Robna_kartica_${meta.articleCode}.xlsx`);
}

// ── Robna kartica ─ PDF ─────────────────────────────────────────────────────

async function buildCardPdf(
  rows: CardRow[],
  meta: CardExportMeta,
  totals: { debit: number; credit: number; balanceQty: number; balanceValue: number }
): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Robna kartica", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  doc.text(`Artikal: ${meta.articleCode} — ${meta.articleName} (${meta.unit})`, 14, y);
  y += 5;
  doc.text(`Magacin: ${meta.warehouseName}`, 14, y);
  if (meta.dateFrom || meta.dateTo) {
    y += 5;
    doc.text(
      `Period: ${meta.dateFrom ? formatDate(meta.dateFrom) : "—"} do ${meta.dateTo ? formatDate(meta.dateTo) : "—"}`,
      14, y
    );
  }
  y += 7;

  const head = [["Datum", "Dokument", "Partner", "Ulaz", "Izlaz", "Cena", "Duguje", "Potražuje", "Stanje", "Saldo"]];
  const body = rows.map((r) => [
    formatDate(r.movement_date),
    `${r.document_type} ${r.document_number}`,
    r.partner_name,
    r.in_quantity > 0 ? formatDecimal(r.in_quantity) : "",
    r.out_quantity > 0 ? formatDecimal(r.out_quantity) : "",
    formatPrice(r.unit_price),
    r.debit_value > 0 ? formatPrice(r.debit_value) : "",
    r.credit_value > 0 ? formatPrice(r.credit_value) : "",
    formatDecimal(r.running_qty),
    formatPrice(r.running_value),
  ]);

  const foot = [["", "Ukupno:", "", "", "", "", formatPrice(totals.debit), formatPrice(totals.credit), formatDecimal(totals.balanceQty), formatPrice(totals.balanceValue)]];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    styles: { font: "Roboto", fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [60, 60, 60], fontStyle: "bold", halign: "center" },
    footStyles: { fillColor: [240, 240, 240], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "left" },
      1: { halign: "left" },
      2: { halign: "left" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
    didParseCell(data) {
      if (data.section === "foot") {
        data.cell.styles.halign = data.column.index <= 2 ? "right" : "right";
      }
    },
  });

  return doc;
}

export async function exportCardToPdf(
  rows: CardRow[],
  meta: CardExportMeta,
  totals: { debit: number; credit: number; balanceQty: number; balanceValue: number }
) {
  const doc = await buildCardPdf(rows, meta, totals);
  doc.save(`Robna_kartica_${meta.articleCode}.pdf`);
}

export async function printCard(
  rows: CardRow[],
  meta: CardExportMeta,
  totals: { debit: number; credit: number; balanceQty: number; balanceValue: number }
) {
  const doc = await buildCardPdf(rows, meta, totals);
  printPdfBlob(doc.output("blob"));
}
