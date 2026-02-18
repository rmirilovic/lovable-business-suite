import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { formatPrice } from "@/lib/formatting";
import { format } from "date-fns";
import type { WorkOrderRequisitionRow } from "@/hooks/useWorkOrderRequisitions";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}
function fmtNum(v: number) {
  return v ? formatPrice(v) : "-";
}

// ── Types for delivery notes ─────────────────────────────────────────────────

interface DNItem {
  article_code: string;
  qty_shift_1: number;
  qty_shift_2: number;
  qty_shift_3: number;
  qty_total: number;
  delivered_kg: number;
  unit_price: number;
  item_value: number;
}

interface DNRow {
  delivery_number: string;
  delivery_date: string;
  production_line: number;
  items: DNItem[];
}

interface ExportMeta {
  companyName: string;
  orderNumber: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUISITIONS EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function mapReqRows(rows: WorkOrderRequisitionRow[]) {
  return rows.map((r) => ({
    Datum: fmtDate(r.requisition_date),
    "Broj trebovanja": r.requisition_number,
    Magacin: `${r.warehouse_code} - ${r.warehouse_name}`,
    Vrednost: fmtNum(r.total_value),
  }));
}

export function exportRequisitionsToExcel(rows: WorkOrderRequisitionRow[], meta: ExportMeta) {
  const data = mapReqRows(rows);
  const total = rows.reduce((s, r) => s + r.total_value, 0);
  data.push({ Datum: "", "Broj trebovanja": "", Magacin: "UKUPNO:", Vrednost: fmtNum(total) });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trebovanja");
  XLSX.writeFile(wb, `trebovanja_RN_${meta.orderNumber}.xlsx`);
}

async function buildReqPdf(rows: WorkOrderRequisitionRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "portrait" });
  configurePdfFonts(doc);

  const pw = doc.internal.pageSize.getWidth();
  let y = 15;
  doc.setFontSize(12);
  doc.text(meta.companyName, pw / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text(`Pregled trebovanja - RN ${meta.orderNumber}`, pw / 2, y, { align: "center" });
  y += 8;

  const total = rows.reduce((s, r) => s + r.total_value, 0);

  const head = [["Datum", "Broj trebovanja", "Magacin", "Vrednost"]];
  const body = rows.map((r) => [
    fmtDate(r.requisition_date),
    r.requisition_number,
    `${r.warehouse_code} - ${r.warehouse_name}`,
    fmtNum(r.total_value),
  ]);
  body.push(["", "", "UKUPNO:", fmtNum(total)]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 9 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold" },
    columnStyles: {
      3: { halign: "right" },
    },
  });

  return doc;
}

export async function exportRequisitionsToPdf(rows: WorkOrderRequisitionRow[], meta: ExportMeta) {
  const doc = await buildReqPdf(rows, meta);
  doc.save(`trebovanja_RN_${meta.orderNumber}.pdf`);
}

export async function printRequisitions(rows: WorkOrderRequisitionRow[], meta: ExportMeta) {
  const doc = await buildReqPdf(rows, meta);
  printPdfBlob(doc.output("blob"));
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY NOTES EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

function flattenDN(notes: DNRow[]) {
  const rows: any[] = [];
  for (const dn of notes) {
    for (const item of dn.items) {
      rows.push({
        Datum: fmtDate(dn.delivery_date),
        Broj: dn.delivery_number,
        "Šifra": item.article_code,
        Linija: dn.production_line,
        "I smena": item.qty_shift_1,
        "II smena": item.qty_shift_2,
        "III smena": item.qty_shift_3,
        "Predato JM": fmtNum(item.qty_total),
        "Predato kg": fmtNum(item.delivered_kg),
        Cena: fmtNum(item.unit_price),
        Vrednost: fmtNum(item.item_value),
      });
    }
  }
  return rows;
}

function dnTotals(notes: DNRow[]) {
  let qtyTotal = 0, kgTotal = 0, valueTotal = 0;
  for (const dn of notes) {
    for (const item of dn.items) {
      qtyTotal += item.qty_total;
      kgTotal += item.delivered_kg;
      valueTotal += item.item_value;
    }
  }
  return { qtyTotal, kgTotal, valueTotal };
}

export function exportDeliveryNotesToExcel(notes: DNRow[], meta: ExportMeta) {
  const data = flattenDN(notes);
  const totals = dnTotals(notes);
  data.push({
    Datum: "", Broj: "", "Šifra": "", Linija: "",
    "I smena": "", "II smena": "", "III smena": "",
    "Predato JM": fmtNum(totals.qtyTotal),
    "Predato kg": fmtNum(totals.kgTotal),
    Cena: "",
    Vrednost: fmtNum(totals.valueTotal),
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
    { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Predajnice");
  XLSX.writeFile(wb, `predajnice_RN_${meta.orderNumber}.xlsx`);
}

async function buildDNPdf(notes: DNRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pw = doc.internal.pageSize.getWidth();
  let y = 15;
  doc.setFontSize(12);
  doc.text(meta.companyName, pw / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text(`Pregled predajnica - RN ${meta.orderNumber}`, pw / 2, y, { align: "center" });
  y += 8;

  const totals = dnTotals(notes);

  const head = [["Datum", "Broj", "Šifra", "Linija", "I sm.", "II sm.", "III sm.", "Predato JM", "Predato kg", "Cena", "Vrednost"]];
  const body: string[][] = [];
  for (const dn of notes) {
    for (const item of dn.items) {
      body.push([
        fmtDate(dn.delivery_date),
        dn.delivery_number,
        item.article_code,
        String(dn.production_line),
        String(item.qty_shift_1),
        String(item.qty_shift_2),
        String(item.qty_shift_3),
        fmtNum(item.qty_total),
        fmtNum(item.delivered_kg),
        fmtNum(item.unit_price),
        fmtNum(item.item_value),
      ]);
    }
  }
  body.push(["", "", "", "", "", "", "", fmtNum(totals.qtyTotal), fmtNum(totals.kgTotal), "", fmtNum(totals.valueTotal)]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold" },
    columnStyles: {
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
      10: { halign: "right" },
    },
  });

  return doc;
}

export async function exportDeliveryNotesToPdf(notes: DNRow[], meta: ExportMeta) {
  const doc = await buildDNPdf(notes, meta);
  doc.save(`predajnice_RN_${meta.orderNumber}.pdf`);
}

export async function printDeliveryNotes(notes: DNRow[], meta: ExportMeta) {
  const doc = await buildDNPdf(notes, meta);
  printPdfBlob(doc.output("blob"));
}
