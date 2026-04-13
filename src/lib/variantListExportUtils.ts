import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { ArticleVariant } from "@/hooks/useArticleVariants";
import { formatDecimal } from "@/lib/formatting";

interface ExportMeta {
  companyName: string;
}

function mapRows(items: ArticleVariant[]) {
  return items.map((v) => ({
    "Šifra": v.code,
    "Dužina": formatDecimal(v.length_value, 1),
    "Opis": v.description,
    "Status": v.is_active ? "Aktivna" : "Neaktivna",
  }));
}

export function exportVariantsToExcel(items: ArticleVariant[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Varijante");
  XLSX.writeFile(wb, "varijante_artikala.xlsx");
}

async function buildPdf(items: ArticleVariant[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "portrait" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Varijante artikala", pageWidth / 2, y, { align: "center" });
  y += 10;

  const rows = items.map((v) => [
    v.code,
    formatDecimal(v.length_value, 1),
    v.description,
    v.is_active ? "Aktivna" : "Neaktivna",
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Šifra", "Dužina", "Opis", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 9 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      1: { halign: "right" },
    },
  });

  return doc;
}

export async function exportVariantsToPdf(items: ArticleVariant[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("varijante_artikala.pdf");
}

export async function printVariants(items: ArticleVariant[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
