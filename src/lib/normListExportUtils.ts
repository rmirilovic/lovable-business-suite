import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { formatDate } from "@/lib/formatting";
import { printPdfBlob } from "@/lib/printPdf";
import type { MaterialNorm } from "@/hooks/useMaterialNorms";

// ── Excel ───────────────────────────────────────────────────────────────────

export function exportNormListToExcel(norms: MaterialNorm[]) {
  const data = norms.map((n, idx) => ({
    "R.br.": idx + 1,
    "Šifra GP": n.article_code || "",
    "Naziv gotovog proizvoda": n.article_name || "",
    "JM": n.article_unit || "",
    "Varijanti": n.variant_count ?? 0,
    "Odobreno": n.approved_variant_count ?? 0,
    "Kreiran": formatDate(n.created_at),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 6 }, { wch: 12 }, { wch: 40 }, { wch: 6 },
    { wch: 10 }, { wch: 10 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Normativi");
  XLSX.writeFile(wb, "Normativi_lista.xlsx");
}

// ── PDF ─────────────────────────────────────────────────────────────────────

async function buildNormListPdf(norms: MaterialNorm[]): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "portrait" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(14);
  doc.setFont("Roboto", "bold");
  doc.text("Normativi utroška materijala", pageWidth / 2, y, { align: "center" });
  y += 10;

  const head = [["R.br.", "Šifra GP", "Naziv gotovog proizvoda", "JM", "Varijanti", "Odobreno", "Kreiran"]];
  const body = norms.map((n, idx) => [
    String(idx + 1),
    n.article_code || "",
    n.article_name || "",
    n.article_unit || "",
    String(n.variant_count ?? 0),
    String(n.approved_variant_count ?? 0),
    formatDate(n.created_at),
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { font: "Roboto", fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [60, 60, 60], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "left", cellWidth: 22 },
      2: { halign: "left" },
      3: { halign: "center", cellWidth: 12 },
      4: { halign: "center", cellWidth: 18 },
      5: { halign: "center", cellWidth: 18 },
      6: { halign: "center", cellWidth: 22 },
    },
  });

  return doc;
}

export async function exportNormListToPdf(norms: MaterialNorm[]) {
  const doc = await buildNormListPdf(norms);
  doc.save("Normativi_lista.pdf");
}

export async function printNormList(norms: MaterialNorm[]) {
  const doc = await buildNormListPdf(norms);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
