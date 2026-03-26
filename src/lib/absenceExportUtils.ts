import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { ABSENCE_TYPE_LABELS } from "@/hooks/useAbsences";
import { format } from "date-fns";

interface AbsenceRow {
  employeeName: string;
  absenceType: string;
  startDate: string;
  endDate: string;
  workDays: number;
  note: string;
}

interface ExportMeta {
  companyName: string;
}

function fmtDate(d: string) {
  return format(new Date(d), "dd.MM.yyyy");
}

function mapRows(items: AbsenceRow[]) {
  return items.map((r) => ({
    Zaposleni: r.employeeName,
    Tip: ABSENCE_TYPE_LABELS[r.absenceType] || r.absenceType,
    Od: fmtDate(r.startDate),
    Do: fmtDate(r.endDate),
    "Radnih dana": r.workDays,
    Napomena: r.note,
  }));
}

export function exportAbsencesToExcel(items: AbsenceRow[], _meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 30 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Odsustva");
  XLSX.writeFile(wb, "odsustva.xlsx");
}

async function buildPdf(items: AbsenceRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Evidencija odsustva", pageWidth / 2, y, { align: "center" });
  y += 8;

  const rows = items.map((r) => [
    r.employeeName,
    ABSENCE_TYPE_LABELS[r.absenceType] || r.absenceType,
    fmtDate(r.startDate),
    fmtDate(r.endDate),
    r.workDays,
    r.note,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Zaposleni", "Tip", "Od", "Do", "Radnih dana", "Napomena"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  return doc;
}

export async function exportAbsencesToPdf(items: AbsenceRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("odsustva.pdf");
}

export async function printAbsences(items: AbsenceRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  printPdfBlob(doc.output("blob"));
}
