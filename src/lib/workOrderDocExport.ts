import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { formatPrice } from "@/lib/formatting";
import { format } from "date-fns";
import type { WorkOrderItem, WorkOrder } from "@/hooks/useWorkOrders";
import type { RWOOutputItem, ReprocessingWorkOrder } from "@/hooks/useReprocessingWorkOrders";

function fmtNum(v: number) {
  return v ? formatPrice(v) : "-";
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGULAR WORK ORDER (RN za izradu GP)
// ═══════════════════════════════════════════════════════════════════════════════

interface WOExportMeta {
  companyName: string;
  order: WorkOrder;
  items: WorkOrderItem[];
}

function mapWORows(items: WorkOrderItem[]) {
  return items.map((item, idx) => ({
    "R.br.": idx + 1,
    "Šifra": item.article_code,
    "Naziv GP": item.article_name,
    "JM": item.unit,
    "Varijanta": item.variant_name || "-",
    "Lans. kol.": fmtNum(item.launched_qty),
    "kg/JM": fmtNum(item.kg_per_unit),
    "Lans. kg": fmtNum(item.launched_kg),
    "Cena": fmtNum(item.unit_price),
    "Vrednost": fmtNum(item.launched_value),
  }));
}

export function exportWOToExcel({ companyName, order, items }: WOExportMeta) {
  const data = mapWORows(items);
  const totalKg = items.reduce((s, i) => s + (i.launched_kg || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.launched_value || 0), 0);
  data.push({
    "R.br.": "" as any, "Šifra": "", "Naziv GP": "", "JM": "", "Varijanta": "",
    "Lans. kol.": "", "kg/JM": "", "Lans. kg": fmtNum(totalKg),
    "Cena": "", "Vrednost": fmtNum(totalValue),
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 6 }, { wch: 10 }, { wch: 30 }, { wch: 6 }, { wch: 14 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];

  // Add notes below data
  const startRow = data.length + 3;
  if (order.production_note) {
    XLSX.utils.sheet_add_aoa(ws, [["Napomena - proizvodnja:", order.production_note]], { origin: `A${startRow}` });
  }
  if (order.plant_note) {
    const noteRow = order.production_note ? startRow + 1 : startRow;
    XLSX.utils.sheet_add_aoa(ws, [["Napomena - pogon:", order.plant_note]], { origin: `A${noteRow}` });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Radni nalog");
  XLSX.writeFile(wb, `RN_${order.order_number}.xlsx`);
}

async function buildWOPdf({ companyName, order, items }: WOExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pw = doc.internal.pageSize.getWidth();
  let y = 15;
  doc.setFontSize(12);
  doc.text(companyName, pw / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text(`Radni nalog ${order.order_number}`, pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.text(`Datum: ${format(new Date(order.order_date), "dd.MM.yyyy")}    Magacin: ${order.warehouse?.code || ""} - ${order.warehouse?.name || ""}`, pw / 2, y, { align: "center" });
  y += 8;

  const totalKg = items.reduce((s, i) => s + (i.launched_kg || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.launched_value || 0), 0);

  const head = [["R.br.", "Šifra", "Naziv GP", "JM", "Varijanta", "Lans. kol.", "kg/JM", "Lans. kg", "Cena", "Vrednost"]];
  const body = items.map((item, idx) => [
    String(idx + 1), item.article_code, item.article_name, item.unit,
    item.variant_name || "-", fmtNum(item.launched_qty), fmtNum(item.kg_per_unit),
    fmtNum(item.launched_kg), fmtNum(item.unit_price), fmtNum(item.launched_value),
  ]);
  body.push(["", "", "", "", "", "", "", fmtNum(totalKg), "", fmtNum(totalValue)]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold" },
    columnStyles: {
      5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" },
      8: { halign: "right" }, 9: { halign: "right" },
    },
  });

  // Add notes below table
  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  if (order.production_note) {
    doc.setFont("Roboto-Bold");
    doc.text("Napomena - proizvodnja:", 14, y);
    doc.setFont("Roboto");
    doc.text(order.production_note, 14, y + 5, { maxWidth: pw - 28 });
    const lines = doc.splitTextToSize(order.production_note, pw - 28);
    y += 5 + lines.length * 4 + 6;
  }
  if (order.plant_note) {
    doc.setFont("Roboto-Bold");
    doc.text("Napomena - pogon:", 14, y);
    doc.setFont("Roboto");
    doc.text(order.plant_note, 14, y + 5, { maxWidth: pw - 28 });
  }

  return doc;
}

export async function exportWOToPdf(meta: WOExportMeta) {
  const doc = await buildWOPdf(meta);
  doc.save(`RN_${meta.order.order_number}.pdf`);
}

export async function printWO(meta: WOExportMeta) {
  const doc = await buildWOPdf(meta);
  printPdfBlob(doc.output("blob"));
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPROCESSING WORK ORDER (RN za preradu)
// ═══════════════════════════════════════════════════════════════════════════════

interface RWOExportMeta {
  companyName: string;
  order: ReprocessingWorkOrder;
  outputItems: RWOOutputItem[];
}

function mapRWORows(items: RWOOutputItem[]) {
  return items.map((item, idx) => ({
    "R.br.": idx + 1,
    "Šifra": item.article_code,
    "Naziv": item.article_name,
    "JM": item.unit,
    "Cena": fmtNum(item.unit_price),
    "Lans. kol.": fmtNum(item.launched_qty),
    "Vrednost": fmtNum(item.launched_value),
  }));
}

export function exportRWOToExcel({ companyName, order, outputItems }: RWOExportMeta) {
  const data = mapRWORows(outputItems);
  const totalValue = outputItems.reduce((s, i) => s + (i.launched_value || 0), 0);
  data.push({
    "R.br.": "" as any, "Šifra": "", "Naziv": "", "JM": "",
    "Cena": "", "Lans. kol.": "UKUPNO:", "Vrednost": fmtNum(totalValue),
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 6 }, { wch: 10 }, { wch: 30 }, { wch: 6 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];

  const startRow = data.length + 3;
  if (order.note) {
    XLSX.utils.sheet_add_aoa(ws, [["Napomena:", order.note]], { origin: `A${startRow}` });
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "RN preradu");
  XLSX.writeFile(wb, `RN_preradu_${order.order_number}.xlsx`);
}

async function buildRWOPdf({ companyName, order, outputItems }: RWOExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "portrait" });
  configurePdfFonts(doc);

  const pw = doc.internal.pageSize.getWidth();
  let y = 15;
  doc.setFontSize(12);
  doc.text(companyName, pw / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text(`RN za preradu ${order.order_number}`, pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.text(`Datum: ${format(new Date(order.order_date), "dd.MM.yyyy")}    Magacin: ${order.warehouse?.code || ""} - ${order.warehouse?.name || ""}`, pw / 2, y, { align: "center" });
  y += 8;

  const totalValue = outputItems.reduce((s, i) => s + (i.launched_value || 0), 0);

  const head = [["R.br.", "Šifra", "Naziv", "JM", "Cena", "Lans. kol.", "Vrednost"]];
  const body = outputItems.map((item, idx) => [
    String(idx + 1), item.article_code, item.article_name, item.unit,
    fmtNum(item.unit_price), fmtNum(item.launched_qty), fmtNum(item.launched_value),
  ]);
  body.push(["", "", "", "", "", "UKUPNO:", fmtNum(totalValue)]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 9 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold" },
    columnStyles: {
      4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" },
    },
  });

  // Add note below table
  y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(9);
  if (order.note) {
    doc.setFont("Roboto-Bold");
    doc.text("Napomena:", 14, y);
    doc.setFont("Roboto");
    doc.text(order.note, 14, y + 5, { maxWidth: pw - 28 });
  }

  return doc;
}

export async function exportRWOToPdf(meta: RWOExportMeta) {
  const doc = await buildRWOPdf(meta);
  doc.save(`RN_preradu_${meta.order.order_number}.pdf`);
}

export async function printRWO(meta: RWOExportMeta) {
  const doc = await buildRWOPdf(meta);
  printPdfBlob(doc.output("blob"));
}
