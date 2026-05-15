import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { format } from "date-fns";
import { formatDecimal } from "@/lib/formatting";

export interface SectionLine {
  code: number;
  label: string;
}

export interface SectionArticleRow {
  article_code: string;
  article_name: string;
  qty_by_line: Record<number, number>;
  total: number;
}

export interface SectionSubclass {
  code: string;
  name: string;
  articles: SectionArticleRow[];
  totals_by_line: Record<number, number>;
  total: number;
}

export interface SectionMainClass {
  code: string;
  name: string;
  subclasses: SectionSubclass[];
  totals_by_line: Record<number, number>;
  total: number;
}

export interface ReportSection {
  production_type: string;
  lines: SectionLine[];
  mainClasses: SectionMainClass[];
  totals_by_line: Record<number, number>;
  total: number;
}

interface ExportMeta {
  companyName: string;
  dateFrom?: string;
  dateTo?: string;
}

const fmtDate = (d?: string) => (d ? format(new Date(d), "dd.MM.yyyy") : "");
const fmtQty = (v: number) => (v ? formatDecimal(v, 0) : "-");

function buildAoa(section: ReportSection): (string | number)[][] {
  const rows: (string | number)[][] = [];
  const header = ["Šifra", "Naziv", ...section.lines.map((l) => l.label), "Ukupno"];
  rows.push([`Vrsta proizvodnje: ${section.production_type}`]);
  rows.push(header);
  section.mainClasses.forEach((mc) => {
    rows.push([`${mc.code} - ${mc.name}`]);
    mc.subclasses.forEach((sc) => {
      rows.push([`  ${sc.code} - ${sc.name}`]);
      sc.articles.forEach((a) => {
        rows.push([
          a.article_code,
          a.article_name,
          ...section.lines.map((l) => (a.qty_by_line[l.code] ? Math.round(a.qty_by_line[l.code]) : 0)),
          Math.round(a.total),
        ]);
      });
    });
  });
  rows.push([
    "",
    "UKUPNO",
    ...section.lines.map((l) => Math.round(section.totals_by_line[l.code] || 0)),
    Math.round(section.total),
  ]);
  rows.push([]);
  return rows;
}

export function exportProizvodnjaPoSifKlasamaToExcel(sections: ReportSection[], _meta: ExportMeta) {
  const wb = XLSX.utils.book_new();
  sections.forEach((s) => {
    const ws = XLSX.utils.aoa_to_sheet(buildAoa(s));
    XLSX.utils.book_append_sheet(wb, ws, s.production_type.substring(0, 28));
  });
  XLSX.writeFile(wb, "proizvodnja_gp_po_siframa_i_klasama.xlsx");
}

async function buildPdf(sections: ReportSection[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape", format: "a4" });
  configurePdfFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  let isFirst = true;
  sections.forEach((s) => {
    if (!isFirst) doc.addPage();
    isFirst = false;
    let y = 12;
    doc.setFontSize(11);
    doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
    y += 6;
    doc.setFontSize(13);
    doc.text(`Proizvodnja GP po šiframa i klasama – ${s.production_type}`, pageWidth / 2, y, { align: "center" });
    y += 5;
    if (meta.dateFrom || meta.dateTo) {
      doc.setFontSize(8);
      doc.text(`Period: ${fmtDate(meta.dateFrom)} - ${fmtDate(meta.dateTo)}`, pageWidth / 2, y, { align: "center" });
      y += 4;
    }

    const head = [["Šifra", "Naziv", ...s.lines.map((l) => l.label), "Ukupno"]];
    const body: any[] = [];
    s.mainClasses.forEach((mc) => {
      body.push([
        {
          content: `${mc.code} - ${mc.name}`,
          colSpan: 2 + s.lines.length + 1,
          styles: { fillColor: [200, 220, 240], fontStyle: "bold" },
        },
      ]);
      mc.subclasses.forEach((sc) => {
        body.push([
          {
            content: `   ${sc.code} - ${sc.name}`,
            colSpan: 2 + s.lines.length + 1,
            styles: { fillColor: [230, 240, 250], fontStyle: "italic" },
          },
        ]);
        sc.articles.forEach((a) => {
          body.push([
            a.article_code,
            a.article_name,
            ...s.lines.map((l) => fmtQty(a.qty_by_line[l.code] || 0)),
            { content: fmtQty(a.total), styles: { fontStyle: "bold" } },
          ]);
        });
      });
    });
    body.push([
      { content: "UKUPNO", colSpan: 2, styles: { halign: "right", fontStyle: "bold", fillColor: [220, 220, 220] } },
      ...s.lines.map((l) => ({
        content: fmtQty(s.totals_by_line[l.code] || 0),
        styles: { fontStyle: "bold", fillColor: [220, 220, 220], halign: "right" },
      })),
      { content: fmtQty(s.total), styles: { fontStyle: "bold", fillColor: [220, 220, 220], halign: "right" } },
    ]);

    autoTable(doc, {
      startY: y,
      head,
      body,
      styles: { font: "Roboto", fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [60, 60, 60], font: "Roboto-Bold", fontSize: 7, halign: "center" },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 70 },
        ...Object.fromEntries(s.lines.map((_, idx) => [2 + idx, { halign: "right", cellWidth: "auto" }])),
        [2 + s.lines.length]: { halign: "right", fontStyle: "bold", cellWidth: "auto" },
      } as any,
    });
  });

  return doc;
}

export async function exportProizvodnjaPoSifKlasamaToPdf(sections: ReportSection[], meta: ExportMeta) {
  const doc = await buildPdf(sections, meta);
  doc.save("proizvodnja_gp_po_siframa_i_klasama.pdf");
}

export async function printProizvodnjaPoSifKlasama(sections: ReportSection[], meta: ExportMeta) {
  const doc = await buildPdf(sections, meta);
  printPdfBlob(doc.output("blob"));
}
