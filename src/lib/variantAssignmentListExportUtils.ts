import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";

interface AssignmentRow {
  article_code: string;
  article_name: string;
  variant_code: string;
  variant_description: string;
}

interface ExportMeta {
  companyName: string;
}

function mapRows(items: AssignmentRow[]) {
  return items.map((r) => ({
    "Šifra artikla": r.article_code,
    "Naziv artikla": r.article_name,
    "Šifra varijante": r.variant_code,
    "Opis varijante": r.variant_description,
  }));
}

export function exportAssignmentsToExcel(items: AssignmentRow[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 15 }, { wch: 35 }, { wch: 15 }, { wch: 35 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Povezivanje");
  XLSX.writeFile(wb, "povezivanje_varijanti.xlsx");
}

async function buildPdf(items: AssignmentRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Povezivanje artikala sa varijantama", pageWidth / 2, y, { align: "center" });
  y += 10;

  const rows = items.map((r) => [
    r.article_code,
    r.article_name,
    r.variant_code,
    r.variant_description,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Šifra artikla", "Naziv artikla", "Šifra varijante", "Opis varijante"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 9 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  return doc;
}

export async function exportAssignmentsToPdf(items: AssignmentRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("povezivanje_varijanti.pdf");
}

export async function printAssignments(items: AssignmentRow[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
