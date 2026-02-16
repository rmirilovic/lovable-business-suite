import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { formatDecimal, formatDate } from "@/lib/formatting";
import type { InventoryListRow } from "@/hooks/useWarehouseInventoryList";

interface ExportMeta {
  warehouseName: string;
  dateFrom?: string;
  dateTo?: string;
}

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
    setTimeout(() => { printFrame.contentWindow?.print(); }, 100);
  };
  document.body.appendChild(printFrame);
  setTimeout(() => {
    document.body.removeChild(printFrame);
    URL.revokeObjectURL(blobUrl);
  }, 60000);
}

// ── Excel ───────────────────────────────────────────────────────────────────

export function exportInventoryListToExcel(rows: InventoryListRow[], meta: ExportMeta) {
  const data = rows.map((r) => ({
    "Šifra": r.article_code,
    "Naziv artikla": r.article_name,
    "JM": r.unit,
    "Donos": r.opening_qty,
    "Ulaz": r.in_qty,
    "Izlaz": r.out_qty,
    "Promet": r.turnover_qty,
    "Stanje": r.closing_qty,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 35 }, { wch: 6 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lager lista");

  const safeName = meta.warehouseName.replace(/[^a-zA-Z0-9а-яА-ЯёЁa-žA-Ž\s_-]/g, "").trim();
  XLSX.writeFile(wb, `Lager_lista_${safeName}.xlsx`);
}

// ── PDF ─────────────────────────────────────────────────────────────────────

async function buildInventoryListPdf(
  rows: InventoryListRow[],
  meta: ExportMeta,
  totals: { opening: number; inQty: number; outQty: number; turnover: number; closing: number }
): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Lager lista", pageWidth / 2, y, { align: "center" });
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

  const head = [["Šifra", "Naziv artikla", "JM", "Donos", "Ulaz", "Izlaz", "Promet", "Stanje"]];
  const body = rows.map((r) => [
    r.article_code,
    r.article_name,
    r.unit,
    formatDecimal(r.opening_qty),
    formatDecimal(r.in_qty),
    formatDecimal(r.out_qty),
    formatDecimal(r.turnover_qty),
    formatDecimal(r.closing_qty),
  ]);

  const foot = [[
    "", "", "Ukupno:",
    formatDecimal(totals.opening),
    formatDecimal(totals.inQty),
    formatDecimal(totals.outQty),
    formatDecimal(totals.turnover),
    formatDecimal(totals.closing),
  ]];

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
    },
    didParseCell(data) {
      if (data.section === "foot") {
        data.cell.styles.halign = data.column.index <= 2 ? "right" : "right";
      }
    },
  });

  return doc;
}

export async function exportInventoryListToPdf(
  rows: InventoryListRow[],
  meta: ExportMeta,
  totals: { opening: number; inQty: number; outQty: number; turnover: number; closing: number }
) {
  const doc = await buildInventoryListPdf(rows, meta, totals);
  const safeName = meta.warehouseName.replace(/[^a-zA-Z0-9а-яА-ЯёЁa-žA-Ž\s_-]/g, "").trim();
  doc.save(`Lager_lista_${safeName}.pdf`);
}

export async function printInventoryList(
  rows: InventoryListRow[],
  meta: ExportMeta,
  totals: { opening: number; inQty: number; outQty: number; turnover: number; closing: number }
) {
  const doc = await buildInventoryListPdf(rows, meta, totals);
  printPdfBlob(doc.output("blob"));
}
