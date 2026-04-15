import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { formatNumber } from "@/lib/formatting";

interface ComputedRow {
  aop: number;
  label: string;
  currentYear: number;
  prevYearOpening: number | null;
  prevYearClosing: number | null;
  bold?: boolean;
  indent?: number;
  separator?: boolean;
  sectionHeader?: boolean;
}

interface ExportMeta {
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyPib: string;
  companyMb: string;
  yearLabel: string;
  prevYearLabel: string;
  reportDate: string;
}

function fmt(v: number | null) {
  if (v === null) return "";
  return formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function exportBilansUspehaToExcel(rows: ComputedRow[], meta: ExportMeta) {
  const prevLabel = meta.prevYearLabel || "Preth.";
  const ws = XLSX.utils.aoa_to_sheet([
    [meta.companyName],
    [`Adresa: ${meta.companyAddress}, ${meta.companyCity}`],
    [`PIB: ${meta.companyPib}    MB: ${meta.companyMb}`],
    [],
    ["BILANS USPEHA"],
    [`Za period od 01.01.${meta.yearLabel} do ${meta.reportDate}`],
    [],
    ["AOP", "Pozicija", "Tekuća godina", `${prevLabel} - poč. stanje`, `${prevLabel} - kr. stanje`],
    ...rows.map((r) => [
      r.aop,
      r.label,
      r.currentYear,
      r.prevYearOpening ?? "",
      r.prevYearClosing ?? "",
    ]),
  ]);

  ws["!cols"] = [{ wch: 8 }, { wch: 60 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bilans uspeha");
  XLSX.writeFile(wb, `bilans_uspeha_${meta.yearLabel}.xlsx`);
}

async function buildPdf(rows: ComputedRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(11);
  doc.text(meta.companyName, pw / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(8);
  doc.text(`${meta.companyAddress}, ${meta.companyCity}`, pw / 2, y, { align: "center" });
  y += 4;
  doc.text(`PIB: ${meta.companyPib}    MB: ${meta.companyMb}`, pw / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(14);
  doc.text("BILANS USPEHA", pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.text(`Za period od 01.01.${meta.yearLabel} do ${meta.reportDate}`, pw / 2, y, { align: "center" });
  y += 8;

  const prevLabel = meta.prevYearLabel || "Preth.";

  const body = rows.map((r) => {
    const indent = "  ".repeat(r.indent || 0);
    return [
      String(r.aop),
      `${indent}${r.label}`,
      fmt(r.currentYear),
      fmt(r.prevYearOpening),
      fmt(r.prevYearClosing),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["AOP", "Pozicija", "Tekuća godina", `${prevLabel} - poč. stanje`, `${prevLabel} - kr. stanje`]],
    body,
    styles: { font: "DejaVuSans", fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [66, 66, 66], fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 32, halign: "right" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 32, halign: "right" },
    },
    didParseCell: (data: any) => {
      if (data.section === "body") {
        const row = rows[data.row.index];
        if (row?.bold) {
          data.cell.styles.fontStyle = "bold";
        }
        if (row?.sectionHeader) {
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    },
  });

  return doc;
}

export async function exportBilansUspehaToPdf(rows: ComputedRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  doc.save(`bilans_uspeha_${meta.yearLabel}.pdf`);
}

export async function printBilansUspeha(rows: ComputedRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
