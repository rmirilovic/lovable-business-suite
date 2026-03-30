import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { Employee, STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, EDUCATION_LEVELS } from "@/hooks/useEmployees";
import { format, differenceInMonths } from "date-fns";
import { formatDate } from "@/lib/formatting";

interface ExportMeta {
  companyName: string;
}

interface ColumnDef {
  key: string;
  label: string;
}

interface ExportOptions {
  visibleColumns?: ColumnDef[];
  orgUnitMap?: Map<string, string>;
}

function fmtDate(d: string | null) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "-";
}

function computeTotalExperience(emp: Employee): string {
  let totalMonths = (emp.work_experience_years || 0) * 12 + (emp.work_experience_months || 0);
  if (emp.employment_date) {
    const start = new Date(emp.employment_date);
    const now = new Date();
    if (start <= now) {
      totalMonths += differenceInMonths(now, start);
    }
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${String(years).padStart(2, "0")}G ${String(months).padStart(2, "0")}M`;
}

const defaultColumns: ColumnDef[] = [
  { key: "employee_number", label: "Šifra" },
  { key: "name", label: "Ime i prezime" },
  { key: "jmbg", label: "JMBG" },
  { key: "job_title", label: "Radno mesto" },
  { key: "employment_type", label: "Vrsta ugovora" },
  { key: "employment_date", label: "Datum zaposlenja" },
  { key: "status", label: "Status" },
];

function getCellValue(emp: Employee, key: string, orgUnitMap?: Map<string, string>): string {
  switch (key) {
    case "employee_number": return emp.employee_number;
    case "name": return `${emp.last_name} ${emp.middle_name ? `(${emp.middle_name}) ` : ""}${emp.first_name}`;
    case "jmbg": return emp.jmbg || "-";
    case "date_of_birth": return emp.date_of_birth ? formatDate(emp.date_of_birth) : "-";
    case "address": return emp.address || "-";
    case "city": return [emp.postal_code, emp.city].filter(Boolean).join(" ") || "-";
    case "job_title": return emp.job_title || "-";
    case "org_unit": return emp.org_unit_id ? (orgUnitMap?.get(emp.org_unit_id) || "-") : "-";
    case "education_level": return emp.education_level ? (EDUCATION_LEVELS[emp.education_level] || emp.education_level) : "-";
    case "employment_type": return EMPLOYMENT_TYPE_LABELS[emp.employment_type] || emp.employment_type;
    case "employment_date": return fmtDate(emp.employment_date);
    case "contracted_salary": return emp.contracted_salary ? new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(emp.contracted_salary) : "-";
    case "bank_account": return emp.bank_account || "-";
    case "work_experience": return computeTotalExperience(emp);
    case "status": return STATUS_LABELS[emp.status] || emp.status;
    default: return "-";
  }
}

function getColumns(opts?: ExportOptions): ColumnDef[] {
  return opts?.visibleColumns && opts.visibleColumns.length > 0
    ? opts.visibleColumns
    : defaultColumns;
}

export function exportEmployeesToExcel(items: Employee[], meta: ExportMeta, opts?: ExportOptions) {
  const cols = getColumns(opts);
  const data = items.map((e) => {
    const row: Record<string, string> = {};
    cols.forEach((col) => {
      row[col.label] = getCellValue(e, col.key, opts?.orgUnitMap);
    });
    return row;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = cols.map((col) => ({
    wch: Math.max(col.label.length + 2, 12),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Zaposleni");
  XLSX.writeFile(wb, "zaposleni.xlsx");
}

async function buildPdf(items: Employee[], meta: ExportMeta, opts?: ExportOptions): Promise<jsPDF> {
  await initializePdfFonts();
  const cols = getColumns(opts);
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

  const head = cols.map((c) => c.label);
  const rows = items.map((e) => cols.map((c) => getCellValue(e, c.key, opts?.orgUnitMap)));

  autoTable(doc, {
    startY: y,
    head: [head],
    body: rows,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  return doc;
}

export async function exportEmployeesToPdf(items: Employee[], meta: ExportMeta, opts?: ExportOptions) {
  const doc = await buildPdf(items, meta, opts);
  doc.save("zaposleni.pdf");
}

export async function printEmployees(items: Employee[], meta: ExportMeta, opts?: ExportOptions) {
  const doc = await buildPdf(items, meta, opts);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
