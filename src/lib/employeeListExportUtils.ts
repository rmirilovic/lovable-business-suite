import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { Employee, STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/hooks/useEmployees";
import { format } from "date-fns";

interface ExportMeta {
  companyName: string;
}

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function mapRows(items: Employee[]) {
  return items.map((e) => ({
    "Šifra": e.employee_number,
    "Prezime": e.last_name,
    "Ime": e.first_name,
    "JMBG": e.jmbg || "-",
    "Radno mesto": e.job_title || "-",
    "Vrsta ugovora": EMPLOYMENT_TYPE_LABELS[e.employment_type] || e.employment_type,
    "Datum zaposlenja": fmtDate(e.employment_date),
    "Status": STATUS_LABELS[e.status] || e.status,
  }));
}

export function exportEmployeesToExcel(items: Employee[], meta: ExportMeta) {
  const data = mapRows(items);
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 10 }, { wch: 20 }, { wch: 18 }, { wch: 16 },
    { wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Zaposleni");
  XLSX.writeFile(wb, "zaposleni.xlsx");
}

async function buildPdf(items: Employee[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text("Zaposleni", pageWidth / 2, y, { align: "center" });
  y += 8;

  const rows = items.map((e) => [
    e.employee_number,
    e.last_name,
    e.first_name,
    e.jmbg || "-",
    e.job_title || "-",
    EMPLOYMENT_TYPE_LABELS[e.employment_type] || e.employment_type,
    fmtDate(e.employment_date),
    STATUS_LABELS[e.status] || e.status,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Šifra", "Prezime", "Ime", "JMBG", "Radno mesto", "Vrsta ugovora", "Datum zaposl.", "Status"]],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  return doc;
}

export async function exportEmployeesToPdf(items: Employee[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  doc.save("zaposleni.pdf");
}

export async function printEmployees(items: Employee[], meta: ExportMeta) {
  const doc = await buildPdf(items, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
