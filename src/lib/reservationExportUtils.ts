import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { formatPrice, formatDecimal, formatDate } from "@/lib/formatting";
import { printPdfBlob } from "@/lib/printPdf";
import type { StockWithReservationsRow, WarehouseReservation } from "@/hooks/useWarehouseReservations";

interface ExportMeta {
  warehouseName: string;
  dateTo?: string;
}

// ── Stanje sa rezervacijama ─ Excel ──────────────────────────────────────────

export function exportStockReservationsToExcel(
  rows: StockWithReservationsRow[],
  meta: ExportMeta
) {
  const data = rows.map((r) => ({
    "Šifra": r.article_code,
    "Naziv artikla": r.article_name,
    "JM": r.unit,
    "Na zalihama": r.balance_qty,
    "Rez. otpremnice": r.reserved_delivery_notes,
    "Rez. fakture": r.reserved_invoices,
    "Rez. ostalo": r.reserved_other,
    "Ukupno rez.": r.total_reserved,
    "Raspoloživo": r.available_qty,
    "Cena": r.unit_price,
    "Vrednost": Math.round(r.balance_qty * r.unit_price * 100) / 100,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 35 }, { wch: 6 },
    { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stanje sa rezervacijama");
  const safeName = meta.warehouseName.replace(/[^a-zA-Z0-9а-яА-ЯёЁa-žA-Ž\s_-]/g, "").trim();
  XLSX.writeFile(wb, `Stanje_rezervacije_${safeName}.xlsx`);
}

// ── Stanje sa rezervacijama ─ PDF ────────────────────────────────────────────

async function buildStockReservationsPdf(
  rows: StockWithReservationsRow[],
  meta: ExportMeta,
  totals: { balanceValue: number; totalReserved: number }
): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Stanje magacina sa rezervacijama", pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(9);
  doc.setFont("Roboto", "normal");
  doc.text(`Magacin: ${meta.warehouseName}`, 14, y);
  if (meta.dateTo) {
    y += 5;
    doc.text(`Na dan: ${formatDate(meta.dateTo)}`, 14, y);
  }
  y += 7;

  const head = [["Šifra", "Naziv artikla", "JM", "Na zalihama", "Rez. otpr.", "Rez. fakt.", "Rez. ostalo", "Ukupno rez.", "Raspoloživo", "Cena", "Vrednost"]];
  const body = rows.map((r) => [
    r.article_code,
    r.article_name,
    r.unit,
    formatDecimal(r.balance_qty),
    formatDecimal(r.reserved_delivery_notes),
    formatDecimal(r.reserved_invoices),
    formatDecimal(r.reserved_other),
    formatDecimal(r.total_reserved),
    formatDecimal(r.available_qty),
    formatPrice(r.unit_price),
    formatPrice(r.balance_qty * r.unit_price),
  ]);

  const foot = [["", "", "", "", "", "", "", formatDecimal(totals.totalReserved), "", "", formatPrice(totals.balanceValue)]];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot,
    styles: { font: "Roboto", fontSize: 7, cellPadding: 2 },
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
      10: { halign: "right" },
    },
    didParseCell(data) {
      if (data.section === "foot") {
        data.cell.styles.halign = "right";
      }
    },
  });

  return doc;
}

export async function exportStockReservationsToPdf(
  rows: StockWithReservationsRow[],
  meta: ExportMeta,
  totals: { balanceValue: number; totalReserved: number }
) {
  const doc = await buildStockReservationsPdf(rows, meta, totals);
  const safeName = meta.warehouseName.replace(/[^a-zA-Z0-9а-яА-ЯёЁa-žA-Ž\s_-]/g, "").trim();
  doc.save(`Stanje_rezervacije_${safeName}.pdf`);
}

export async function printStockReservations(
  rows: StockWithReservationsRow[],
  meta: ExportMeta,
  totals: { balanceValue: number; totalReserved: number }
) {
  const doc = await buildStockReservationsPdf(rows, meta, totals);
  printPdfBlob(doc.output("blob"));
}

// ── Lista rezervacija ─ Excel ────────────────────────────────────────────────

export function exportReservationsListToExcel(rows: WarehouseReservation[]) {
  const data = rows.map((r) => ({
    "Datum": formatDate(r.reservation_date),
    "Vrsta dok.": r.document_type,
    "Broj dok.": r.document_number,
    "Šifra artikla": r.article_code,
    "Naziv artikla": r.article_name,
    "JM": r.unit,
    "Količina": r.quantity,
    "Partner": r.partner_name || "",
    "Operater": r.created_by_name,
    "Napomena": r.note || "",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 16 }, { wch: 14 },
    { wch: 12 }, { wch: 30 }, { wch: 6 },
    { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 25 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rezervacije");
  XLSX.writeFile(wb, `Rezervacije.xlsx`);
}
