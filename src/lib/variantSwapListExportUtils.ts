import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { VariantSwap } from "@/hooks/useVariantSwaps";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjiženo",
};

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function mapRows(items: VariantSwap[]) {
  return items.map((s) => ({
    "Broj": s.swap_number,
    "Datum": fmtDate(s.swap_date),
    "Artikal šifra": s.article?.code ?? "",
    "Artikal naziv": s.article?.name ?? "",
    "Magacin": `${s.warehouse?.code ?? ""} — ${s.warehouse?.name ?? ""}`,
    "Sa varijante": s.source_variant?.code ?? "",
    "Na varijantu": s.target_variant?.code ?? "",
    "Količina": s.quantity,
    "Status": statusLabels[s.status] ?? s.status,
  }));
}

export function exportVariantSwapsToExcel(items: VariantSwap[], _meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 32 }, { wch: 24 },
    { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Zamene varijanti");
  XLSX.writeFile(wb, "zamene_varijanti.xlsx");
}

async function buildPdf(items: VariantSwap[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Zamene varijanti", pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${meta.dateFrom ? fmtDate(meta.dateFrom) : "..."} - ${meta.dateTo ? fmtDate(meta.dateTo) : "..."}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const rows = items.map((s) => [
    s.swap_number,
    fmtDate(s.swap_date),
    s.article?.code ?? "",
    s.article?.name ?? "",
    `${s.warehouse?.code ?? ""} — ${s.warehouse?.name ?? ""}`,
    s.source_variant?.code ?? "",
    s.target_variant?.code ?? "",
    formatNumber(s.quantity, { minimumFractionDigits: 3 }),
    statusLabels[s.status] ?? s.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Broj", "Datum", "Šifra", "Artikal", "Magacin", "Sa varij.", "Na varij.", "Količina", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      7: { halign: "right" },
    },
  });

  return doc;
}

export async function exportVariantSwapsToPdf(items: VariantSwap[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("zamene_varijanti.pdf");
}

export async function printVariantSwaps(items: VariantSwap[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
