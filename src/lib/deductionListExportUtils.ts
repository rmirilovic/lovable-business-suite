import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { EmployeeDeduction, DEDUCTION_TYPE_LABELS } from "@/hooks/useEmployeeDeductions";
import { formatPrice } from "@/lib/formatting";

interface ExportMeta {
  companyName: string;
  empMap: Record<string, string>;
}

function getStatus(d: EmployeeDeduction): string {
  if (d.is_credit && d.total_installments > 0 && d.paid_installments >= d.total_installments) return "Otplaćen";
  return d.is_active ? "Aktivan" : "Neaktivan";
}

function getRow(d: EmployeeDeduction, empMap: Record<string, string>) {
  return {
    "Zaposleni": empMap[d.employee_id] || d.employee_id,
    "Tip": DEDUCTION_TYPE_LABELS[d.deduction_type] || d.deduction_type,
    "Opis": d.description,
    "Kreditor": d.creditor_name || "—",
    "Rata": formatPrice(d.amount_per_installment),
    "Otplaćeno": d.is_credit ? String(d.paid_installments) : "—",
    "Ukupno rata": d.is_credit ? String(d.total_installments) : "—",
    "Ukupan iznos": d.is_credit ? formatPrice(d.total_amount) : "—",
    "Status": getStatus(d),
  };
}

const COLUMNS = ["Zaposleni", "Tip", "Opis", "Kreditor", "Rata", "Otplaćeno", "Ukupno rata", "Ukupan iznos", "Status"];

export function exportDeductionsToExcel(items: EmployeeDeduction[], meta: ExportMeta) {
  const data = items.map((d) => getRow(d, meta.empMap));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = COLUMNS.map((c) => ({ wch: Math.max(c.length + 2, 12) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Obustave");
  XLSX.writeFile(wb, "obustave.xlsx");
}

async function buildPdf(items: EmployeeDeduction[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Obustave od zarada", pageWidth / 2, y, { align: "center" });
  y += 8;

  const rows = items.map((d) => {
    const r = getRow(d, meta.empMap);
    return COLUMNS.map((c) => r[c as keyof typeof r]);
  });

  autoTable(doc, {
    startY: y,
    head: [COLUMNS],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  return doc;
}

export async function exportDeductionsToPdf(items: EmployeeDeduction[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("obustave.pdf");
}

export async function printDeductions(items: EmployeeDeduction[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
