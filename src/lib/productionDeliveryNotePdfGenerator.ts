import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import {
  ProductionDeliveryNote,
  ProductionDeliveryNoteItem,
  PDN_STATUS_LABELS,
} from "@/hooks/useProductionDeliveryNotes";
import { format } from "date-fns";
import { formatNumber, formatPrice } from "@/lib/formatting";

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function fmtNum(v: number, dec = 2) {
  return formatNumber(v, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtQty(v: number) {
  return v ? formatNumber(v, { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : "-";
}

interface ExportContext {
  note: ProductionDeliveryNote;
  items: ProductionDeliveryNoteItem[];
  companyName: string;
  shiftManagers?: { sm1?: string; sm2?: string; sm3?: string };
}

// ── Excel ────────────────────────────────────────────────────────────────────

export function exportProductionDeliveryNoteToExcel(ctx: ExportContext) {
  const { note, items } = ctx;

  const data = items.map((item, idx) => ({
    "R.br.": idx + 1,
    "Šifra": item.article_code,
    "Naziv": item.article_name,
    "JM": item.unit,
    "kg/JM": fmtNum(item.kg_per_unit, 3),
    "Lans. kol.": fmtQty(item.launched_qty),
    "I smena": fmtQty(item.qty_shift_1),
    "II smena": fmtQty(item.qty_shift_2),
    "III smena": fmtQty(item.qty_shift_3),
    "Ukupno": fmtQty(item.qty_total),
    "Pred. kg": fmtNum(item.delivered_kg),
    "Pred. m": fmtNum(item.delivered_m),
    "Pred. kom": fmtQty(item.delivered_pcs),
    "Škart": fmtQty(item.scrap_qty),
    "Cena": fmtNum(item.unit_price),
    "Vrednost": fmtNum(item.item_value),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 6 }, { wch: 10 }, { wch: 30 }, { wch: 5 }, { wch: 8 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Predajnica");
  XLSX.writeFile(wb, `predajnica_${note.delivery_number}.xlsx`);
}

// ── PDF (shared builder) ─────────────────────────────────────────────────────

async function buildPdf(ctx: ExportContext): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  const { note, items, companyName, shiftManagers } = ctx;
  let y = 15;

  // Company name
  doc.setFontSize(11);
  doc.text(companyName, pageWidth / 2, y, { align: "center" });
  y += 7;

  // Title
  doc.setFontSize(14);
  doc.text(`Predajnica GP ${note.delivery_number}`, pageWidth / 2, y, { align: "center" });
  y += 8;

  // Header info
  doc.setFontSize(9);
  const headerLines = [
    `Datum: ${fmtDate(note.delivery_date)}    Magacin: ${note.warehouse?.code ?? "-"} - ${note.warehouse?.name ?? ""}    Linija: ${note.production_line}    RN: ${note.work_order?.order_number ?? "-"}`,
  ];
  if (shiftManagers) {
    const smLine = [
      shiftManagers.sm1 ? `I: ${shiftManagers.sm1}` : null,
      shiftManagers.sm2 ? `II: ${shiftManagers.sm2}` : null,
      shiftManagers.sm3 ? `III: ${shiftManagers.sm3}` : null,
    ].filter(Boolean).join("    ");
    if (smLine) headerLines.push(`Šefovi smena: ${smLine}`);
  }

  headerLines.forEach((line) => {
    doc.text(line, 14, y);
    y += 5;
  });

  y += 3;

  // Table
  const head = [["R.br.", "Šifra", "Naziv", "JM", "kg/JM", "Lans.", "I sm.", "II sm.", "III sm.", "Ukupno", "Pred. kg", "Pred. m", "Pred. kom", "Škart", "Cena", "Vrednost"]];
  const body = items.map((item, idx) => [
    String(idx + 1),
    item.article_code,
    item.article_name,
    item.unit,
    fmtNum(item.kg_per_unit, 3),
    fmtQty(item.launched_qty),
    fmtQty(item.qty_shift_1),
    fmtQty(item.qty_shift_2),
    fmtQty(item.qty_shift_3),
    fmtQty(item.qty_total),
    fmtNum(item.delivered_kg),
    fmtNum(item.delivered_m),
    fmtQty(item.delivered_pcs),
    fmtQty(item.scrap_qty),
    fmtNum(item.unit_price),
    fmtNum(item.item_value),
  ]);

  const totalKg = items.reduce((s, i) => s + (i.delivered_kg || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.item_value || 0), 0);

  body.push(["", "", "", "", "", "", "", "", "", "", fmtNum(totalKg), "", "", "", "", fmtNum(totalValue)]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 7 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold", fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 16 },
      2: { cellWidth: 40 },
      3: { cellWidth: 10 },
      4: { cellWidth: 14, halign: "right" },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 16, halign: "right" },
      8: { cellWidth: 16, halign: "right" },
      9: { cellWidth: 16, halign: "right" },
      10: { cellWidth: 18, halign: "right" },
      11: { cellWidth: 16, halign: "right" },
      12: { cellWidth: 18, halign: "right" },
      13: { cellWidth: 14, halign: "right" },
      14: { cellWidth: 16, halign: "right" },
      15: { cellWidth: 20, halign: "right" },
    },
    didParseCell: (data: any) => {
      // Bold last row (totals)
      if (data.row.index === body.length - 1) {
        data.cell.styles.font = "Roboto-Bold";
        data.cell.styles.fillColor = [240, 240, 240];
      }
    },
  });

  return doc;
}

// ── PDF download ─────────────────────────────────────────────────────────────

export async function exportProductionDeliveryNoteToPdf(ctx: ExportContext) {
  const doc = await buildPdf(ctx);
  doc.save(`predajnica_${ctx.note.delivery_number}.pdf`);
}

// ── Print ────────────────────────────────────────────────────────────────────

export async function printProductionDeliveryNote(ctx: ExportContext) {
  const doc = await buildPdf(ctx);
  printPdfBlob(doc.output("blob"));
}
