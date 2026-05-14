import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import type { ProductionLine } from "@/hooks/useProductionLines";

interface Meta { companyName: string }

function rows(items: ProductionLine[]) {
  return items.map((l) => ({
    Šifra: l.code,
    Naziv: l.name,
    "Vrsta proizvodnje": l.production_type,
    Status: l.is_active ? "Aktivna" : "Neaktivna",
  }));
}

export function exportProductionLinesToExcel(items: ProductionLine[]) {
  const ws = XLSX.utils.json_to_sheet(rows(items));
  ws["!cols"] = [{ wch: 8 }, { wch: 40 }, { wch: 22 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Proizvodne linije");
  XLSX.writeFile(wb, "proizvodne_linije.xlsx");
}

async function buildPdf(items: ProductionLine[], meta: Meta) {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "portrait", format: "a4" });
  configurePdfFonts(doc);
  const w = doc.internal.pageSize.getWidth();
  let y = 12;
  doc.setFontSize(11);
  doc.text(meta.companyName, w / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(13);
  doc.text("Šifarnik proizvodnih linija", w / 2, y, { align: "center" });
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Šifra", "Naziv", "Vrsta proizvodnje", "Status"]],
    body: items.map((l) => [String(l.code), l.name, l.production_type, l.is_active ? "Aktivna" : "Neaktivna"]),
    styles: { font: "Roboto", fontSize: 9, cellPadding: 1.5 },
    headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold", fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 18, halign: "center" },
      1: { cellWidth: 90 },
      2: { cellWidth: 50 },
      3: { cellWidth: 25, halign: "center" },
    },
  });
  return doc;
}

export async function exportProductionLinesToPdf(items: ProductionLine[], meta: Meta) {
  const doc = await buildPdf(items, meta);
  doc.save("proizvodne_linije.pdf");
}

export async function printProductionLines(items: ProductionLine[], meta: Meta) {
  const doc = await buildPdf(items, meta);
  printPdfBlob(doc.output("blob"));
}
