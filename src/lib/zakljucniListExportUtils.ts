import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { initializePdfFonts, configurePdfFonts } from "@/lib/pdfFonts";
import { printPdfBlob } from "@/lib/printPdf";
import { formatNumber } from "@/lib/formatting";
import type { ZakljucniListRow, ZakljucniListLevel } from "@/hooks/useZakljucniList";

interface ExportMeta {
  companyName: string;
  dateFrom: string;
  dateTo: string;
  accountFrom: string;
  accountTo: string;
  yearLabel: string;
  level: ZakljucniListLevel;
}

const LEVEL_LABEL: Record<ZakljucniListLevel, string> = {
  class: "Po klasama",
  two: "Dve cifre",
  three: "Tri cifre",
  full: "Sva konta",
  analytics: "Sa analitikom",
};

function fmt(v: number) {
  return formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function totals(rows: ZakljucniListRow[]) {
  // Sum only NON-aggregate (leaf) rows so totals don't double-count parents.
  // For purely-aggregate levels (class/two/three) every row is aggregate; in
  // that case we sum all rows since they don't overlap.
  const leafRows = rows.filter((r) => !r.is_aggregate);
  const target = leafRows.length > 0 ? leafRows : rows;
  return target.reduce(
    (acc, r) => ({
      opening_debit: acc.opening_debit + r.opening_debit,
      opening_credit: acc.opening_credit + r.opening_credit,
      period_debit: acc.period_debit + r.period_debit,
      period_credit: acc.period_credit + r.period_credit,
      total_debit: acc.total_debit + r.total_debit,
      total_credit: acc.total_credit + r.total_credit,
      balance: acc.balance + r.balance,
    }),
    {
      opening_debit: 0,
      opening_credit: 0,
      period_debit: 0,
      period_credit: 0,
      total_debit: 0,
      total_credit: 0,
      balance: 0,
    },
  );
}

export function exportZakljucniListToExcel(rows: ZakljucniListRow[], meta: ExportMeta) {
  const data = rows.map((r) => ({
    "Šifra konta": r.code,
    "Opis konta": r.description,
    "Početno duguje": r.opening_debit,
    "Početno potražuje": r.opening_credit,
    "Promet duguje": r.period_debit,
    "Promet potražuje": r.period_credit,
    "Ukupno duguje": r.total_debit,
    "Ukupno potražuje": r.total_credit,
    Saldo: r.balance,
  }));

  const t = totals(rows);
  data.push({
    "Šifra konta": "UKUPNO",
    "Opis konta": "",
    "Početno duguje": t.opening_debit,
    "Početno potražuje": t.opening_credit,
    "Promet duguje": t.period_debit,
    "Promet potražuje": t.period_credit,
    "Ukupno duguje": t.total_debit,
    "Ukupno potražuje": t.total_credit,
    Saldo: t.balance,
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 16 }, { wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Zaključni list");
  XLSX.writeFile(wb, `zakljucni_list_${meta.yearLabel}_${meta.dateTo}.xlsx`);
}

async function buildPdf(rows: ZakljucniListRow[], meta: ExportMeta): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  const pw = doc.internal.pageSize.getWidth();
  let y = 12;

  doc.setFontSize(12);
  doc.text(meta.companyName, pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(14);
  doc.text("Zaključni list", pw / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(9);
  const periodLabel = meta.dateFrom
    ? `Period: ${meta.dateFrom} - ${meta.dateTo}`
    : `Do datuma: ${meta.dateTo}`;
  doc.text(
    `${periodLabel}    Konta: ${meta.accountFrom} - ${meta.accountTo}    Godina: ${meta.yearLabel}    Pregled: ${LEVEL_LABEL[meta.level]}`,
    pw / 2,
    y,
    { align: "center" },
  );
  y += 5;

  const t = totals(rows);

  const body = rows.map((r) => [
    r.code,
    r.description,
    fmt(r.opening_debit),
    fmt(r.opening_credit),
    fmt(r.period_debit),
    fmt(r.period_credit),
    fmt(r.total_debit),
    fmt(r.total_credit),
    fmt(r.balance),
  ]);

  autoTable(doc, {
    startY: y,
    head: [[
      "Šifra konta",
      "Opis konta",
      "Poč. duguje",
      "Poč. potražuje",
      "Promet duguje",
      "Promet potražuje",
      "Ukup. duguje",
      "Ukup. potražuje",
      "Saldo",
    ]],
    body,
    foot: [[
      "UKUPNO",
      "",
      fmt(t.opening_debit),
      fmt(t.opening_credit),
      fmt(t.period_debit),
      fmt(t.period_credit),
      fmt(t.total_debit),
      fmt(t.total_credit),
      fmt(t.balance),
    ]],
    styles: { font: "DejaVuSans", fontSize: 7 },
    headStyles: { fillColor: [66, 66, 66] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 26, halign: "right" },
      3: { cellWidth: 26, halign: "right" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 26, halign: "right" },
      6: { cellWidth: 26, halign: "right" },
      7: { cellWidth: 26, halign: "right" },
      8: { cellWidth: 28, halign: "right" },
    },
    didParseCell: (data) => {
      const row = rows[data.row.index];
      if (data.section === "body" && row?.is_aggregate) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 245, 245];
      }
    },
  });

  return doc;
}

export async function exportZakljucniListToPdf(rows: ZakljucniListRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  doc.save(`zakljucni_list_${meta.yearLabel}_${meta.dateTo}.pdf`);
}

export async function printZakljucniList(rows: ZakljucniListRow[], meta: ExportMeta) {
  const doc = await buildPdf(rows, meta);
  const blob = doc.output("blob");
  printPdfBlob(blob);
}
