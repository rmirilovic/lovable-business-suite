import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { formatPrice, formatDate } from "@/lib/formatting";
import type { WarehouseTurnoverRow } from "@/hooks/useWarehouseTurnover";
import { printPdfBlob } from "@/lib/printPdf";

interface TurnoverExportMeta {
  dateFrom?: string;
  dateTo?: string;
}

// ── Excel ───────────────────────────────────────────────────────────────────

export function exportTurnoverToExcel(rows: WarehouseTurnoverRow[], meta: TurnoverExportMeta) {
  const data = rows.map((r) => ({
    "Šifra mag.": r.warehouse_code,
    "Magacin": r.warehouse_name,
    "Vrsta dokumenta": r.document_type,
    "Duguje": Number(r.debit_value),
    "Potražuje": Number(r.credit_value),
    "Saldo": Number(r.balance_value),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 30 }, { wch: 22 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Promet magacina");
  XLSX.writeFile(wb, "Promet_magacina.xlsx");
}

// ── PDF ─────────────────────────────────────────────────────────────────────

async function buildTurnoverPdf(
  rows: WarehouseTurnoverRow[],
  meta: TurnoverExportMeta,
  totals: { debit: number; credit: number; balance: number }
): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Promet magacina", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  if (meta.dateFrom || meta.dateTo) {
    doc.text(
      `Period: ${meta.dateFrom ? formatDate(meta.dateFrom) : "—"} do ${meta.dateTo ? formatDate(meta.dateTo) : "—"}`,
      14, y
    );
    y += 5;
  }
  y += 4;

  const head = [["Šifra mag.", "Magacin", "Vrsta dokumenta", "Duguje", "Potražuje", "Saldo"]];
  const body = rows.map((r) => [
    r.warehouse_code,
    r.warehouse_name,
    r.document_type,
    formatPrice(Number(r.debit_value)),
    formatPrice(Number(r.credit_value)),
    formatPrice(Number(r.balance_value)),
  ]);

  const foot = [["", "", "Ukupno:", formatPrice(totals.debit), formatPrice(totals.credit), formatPrice(totals.balance)]];

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
    },
    didParseCell(data) {
      if (data.section === "foot") {
        data.cell.styles.halign = data.column.index <= 2 ? "right" : "right";
      }
    },
  });

  return doc;
}

export async function exportTurnoverToPdf(
  rows: WarehouseTurnoverRow[],
  meta: TurnoverExportMeta,
  totals: { debit: number; credit: number; balance: number }
) {
  const doc = await buildTurnoverPdf(rows, meta, totals);
  doc.save("Promet_magacina.pdf");
}

export async function printTurnover(
  rows: WarehouseTurnoverRow[],
  meta: TurnoverExportMeta,
  totals: { debit: number; credit: number; balance: number }
) {
  const doc = await buildTurnoverPdf(rows, meta, totals);
  printPdfBlob(doc.output("blob"));
}
