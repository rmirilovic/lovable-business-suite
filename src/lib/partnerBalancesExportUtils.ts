import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { formatDecimal } from "@/lib/formatting";
import { format } from "date-fns";
import type { PartnerBalanceRow } from "@/hooks/usePartnerBalances";

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

function computeTotals(rows: PartnerBalanceRow[]) {
  return rows.reduce(
    (acc, r) => ({
      debit: acc.debit + r.debit,
      credit: acc.credit + r.credit,
      balance: acc.balance + r.balance,
    }),
    { debit: 0, credit: 0, balance: 0 }
  );
}

function fmtNum(v: number) {
  return formatDecimal(v, 2);
}

async function buildPdf(rows: PartnerBalanceRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFontSize(12);
  doc.text(meta.companyName, pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(14);
  doc.text(`${meta.title} - ${meta.accountLabel}`, pageWidth / 2, y, { align: "center" });
  y += 6;

  if (meta.dateFrom || meta.dateTo) {
    doc.setFontSize(9);
    const period = `Period: ${fmtDate(meta.dateFrom)} - ${fmtDate(meta.dateTo)}`;
    doc.text(period, pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  const totals = computeTotals(rows);

  const body = rows.map((r) => [
    r.partner_code,
    r.partner_name,
    fmtNum(r.debit),
    fmtNum(r.credit),
    fmtNum(r.balance),
  ]);

  body.push([
    "",
    "UKUPNO",
    fmtNum(totals.debit),
    fmtNum(totals.credit),
    fmtNum(totals.balance),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Šifra", "Naziv partnera", "Duguje", "Potražuje", "Saldo"]],
    body,
    styles: { font: "Roboto", fontSize: 8 },
    headStyles: { fillColor: [66, 66, 66] },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: "auto" },
      2: { halign: "right", cellWidth: 35 },
      3: { halign: "right", cellWidth: 35 },
      4: { halign: "right", cellWidth: 35 },
    },
    didParseCell: (data) => {
      // Bold last row (totals)
      if (data.row.index === body.length - 1) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return doc;
}

export async function exportPartnerBalancesToPdf(rows: PartnerBalanceRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  const fileName = `${meta.title.replace(/\s+/g, "_")}_${meta.accountLabel}.pdf`;
  doc.save(fileName);
}

export async function printPartnerBalances(rows: PartnerBalanceRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  printPdfBlob(doc.output("blob"));
}
