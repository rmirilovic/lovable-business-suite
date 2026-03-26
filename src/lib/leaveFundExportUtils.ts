import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";

export interface LeaveFundRow {
  employeeNumber: string;
  employeeName: string;
  totalDays: number;
  usedGO: number;
  remaining: number;
  sickDays: number;
  paidLeave: number;
  unpaidLeave: number;
}

interface ExportMeta {
  companyName: string;
  year: number;
}

function mapRows(items: LeaveFundRow[]) {
  return items.map((r) => ({
    Šifra: r.employeeNumber,
    Zaposleni: r.employeeName,
    "Fond (dana)": r.totalDays,
    "Iskorišćeno GO": r.usedGO,
    Preostalo: r.remaining,
    Bolovanje: r.sickDays,
    "Plaćeno ods.": r.paidLeave,
    "Neplaćeno ods.": r.unpaidLeave,
  }));
}

export function exportLeaveFundToExcel(items: LeaveFundRow[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Fond GO ${meta.year}`);
  XLSX.writeFile(wb, `fond_go_${meta.year}.xlsx`);
}

async function buildPdf(items: LeaveFundRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text(`Fond godišnjeg odmora – ${meta.year}`, pageWidth / 2, y, { align: "center" });
  y += 8;

  const rows = items.map((r) => [
    r.employeeNumber,
    r.employeeName,
    r.totalDays,
    r.usedGO,
    r.remaining,
    r.sickDays,
    r.paidLeave,
    r.unpaidLeave,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Šifra", "Zaposleni", "Fond (dana)", "Iskorišćeno", "Preostalo", "Bolovanje", "Plaćeno ods.", "Neplaćeno ods."]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
    },
  });

  return doc;
}

export async function exportLeaveFundToPdf(items: LeaveFundRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save(`fond_go_${meta.year}.pdf`);
}

export async function printLeaveFund(items: LeaveFundRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  printPdfBlob(doc.output("blob"));
}
