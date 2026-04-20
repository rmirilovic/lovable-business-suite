import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { formatNumber } from "@/lib/formatting";

export interface ProductionCostExportRow {
  orgUnitCode: string;
  orgUnitName: string;
  accountCode: string;
  accountName: string;
  materialAmount: number;
  laborAmount: number;
  otherDirectAmount: number;
  total: number;
}

interface ExportMeta {
  companyName: string;
  dateFrom: string;
  dateTo: string;
}

function fmt(v: number) {
  return v !== 0 ? formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
}

export function exportProductionCostToExcel(rows: ProductionCostExportRow[], meta: ExportMeta) {
  const data = rows.map((r) => ({
    "Šifra MT": r.orgUnitCode,
    "Naziv MT": r.orgUnitName,
    "Konto": r.accountCode,
    "Opis konta": r.accountName,
    "Materijal": r.materialAmount,
    "Rad": r.laborAmount,
    "Ostali direktni": r.otherDirectAmount,
    "UKUPNO": r.total,
  }));

  const totals = {
    "Šifra MT": "UKUPNO",
    "Naziv MT": "",
    "Konto": "",
    "Opis konta": "",
    "Materijal": rows.reduce((s, r) => s + r.materialAmount, 0),
    "Rad": rows.reduce((s, r) => s + r.laborAmount, 0),
    "Ostali direktni": rows.reduce((s, r) => s + r.otherDirectAmount, 0),
    "UKUPNO": rows.reduce((s, r) => s + r.total, 0),
  };
  data.push(totals as any);

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 10 }, { wch: 28 }, { wch: 10 }, { wch: 28 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Obracun proizvodnje");
  XLSX.writeFile(wb, `obracun_proizvodnje_${meta.dateFrom}_${meta.dateTo}.xlsx`);
}

async function buildPdf(rows: ProductionCostExportRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  configurePdfFonts(doc);

  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pw / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(14);
  doc.text("Obračun troškova proizvodnje", pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.text(`Period: ${meta.dateFrom} - ${meta.dateTo}`, pw / 2, y, { align: "center" });
  y += 6;

  const head = ["Šifra MT", "Naziv MT", "Konto", "Opis konta", "Materijal", "Rad", "Ostali direktni", "UKUPNO"];
  const body = rows.map((r) => [
    r.orgUnitCode,
    r.orgUnitName,
    r.accountCode,
    r.accountName,
    fmt(r.materialAmount),
    fmt(r.laborAmount),
    fmt(r.otherDirectAmount),
    fmt(r.total),
  ]);

  const totMat = rows.reduce((s, r) => s + r.materialAmount, 0);
  const totLab = rows.reduce((s, r) => s + r.laborAmount, 0);
  const totOth = rows.reduce((s, r) => s + r.otherDirectAmount, 0);
  const totGrand = rows.reduce((s, r) => s + r.total, 0);

  const foot = [
    "", "", "", `Ukupno (${rows.length})`,
    fmt(totMat), fmt(totLab), fmt(totOth), fmt(totGrand),
  ];

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    foot: [foot],
    styles: { font: "DejaVuSans", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 50 },
      2: { cellWidth: 22 },
      3: { cellWidth: 50 },
      4: { cellWidth: 32, halign: "right" },
      5: { cellWidth: 32, halign: "right" },
      6: { cellWidth: 34, halign: "right" },
      7: { cellWidth: 32, halign: "right" },
    },
  });

  return doc;
}

export async function exportProductionCostPdf(rows: ProductionCostExportRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  doc.save(`obracun_proizvodnje_${meta.dateFrom}_${meta.dateTo}.pdf`);
}

export async function printProductionCost(rows: ProductionCostExportRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
