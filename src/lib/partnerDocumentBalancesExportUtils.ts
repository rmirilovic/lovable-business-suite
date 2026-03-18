import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { formatDecimal } from "@/lib/formatting";
import { format } from "date-fns";
import type { PartnerDocumentRow } from "@/hooks/usePartnerDocumentBalances";

interface ExportMeta {
  companyName: string;
  title: string;
  accountLabel: string;
  dateFrom?: string;
  dateTo?: string;
}

function fmtDate(d: string | null | undefined) {
  return d ? format(new Date(d), "dd.MM.yyyy") : "...";
}

function fmtNum(v: number) {
  return formatDecimal(v, 2);
}

function computeTotals(rows: PartnerDocumentRow[]) {
  return rows.reduce(
    (acc, r) => ({
      debit: acc.debit + r.debit,
      credit: acc.credit + r.credit,
      saldo: acc.saldo + r.saldo,
    }),
    { debit: 0, credit: 0, saldo: 0 }
  );
}

async function buildPdf(
  rows: PartnerDocumentRow[],
  meta: ExportMeta
): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text(`${meta.title} - ${meta.accountLabel}`, pageWidth / 2, y, {
    align: "center",
  });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    doc.text(
      `Period: ${fmtDate(meta.dateFrom)} - ${fmtDate(meta.dateTo)}`,
      pageWidth / 2,
      y,
      { align: "center" }
    );
    y += 6;
  }

  const totals = computeTotals(rows);

  const body = rows.map((r) => [
    r.partner_code,
    r.partner_name,
    r.document_number,
    r.document_date ? fmtDate(r.document_date) : "",
    r.days_overdue !== null ? String(r.days_overdue) : "-",
    fmtNum(r.debit),
    fmtNum(r.credit),
    fmtNum(r.saldo),
  ]);

  body.push([
    "",
    "UKUPNO",
    "",
    "",
    "",
    fmtNum(totals.debit),
    fmtNum(totals.credit),
    fmtNum(totals.saldo),
  ]);

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Šifra",
        "Naziv partnera",
        "Broj dokumenta",
        "Valuta",
        "Kasni",
        "Duguje",
        "Potražuje",
        "Saldo",
      ],
    ],
    body,
    styles: { font: "Roboto", fontSize: 7 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 35 },
      3: { cellWidth: 22 },
      4: { halign: "right", cellWidth: 16 },
      5: { halign: "right", cellWidth: 28 },
      6: { halign: "right", cellWidth: 28 },
      7: { halign: "right", cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return doc;
}

export async function exportPartnerDocumentsToPdf(
  rows: PartnerDocumentRow[],
  meta: ExportMeta
) {
  const doc = await buildPdf(rows, meta);
  doc.save(
    `${meta.title.replace(/\s+/g, "_")}_${meta.accountLabel}.pdf`
  );
}

export async function printPartnerDocuments(
  rows: PartnerDocumentRow[],
  meta: ExportMeta
) {
  const doc = await buildPdf(rows, meta);
  printPdfBlob(doc.output("blob"));
}
