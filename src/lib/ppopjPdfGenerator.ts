import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { configurePdfFonts, initializePdfFonts } from "./pdfFonts";
import { formatPrice } from "./formatting";
import { format } from "date-fns";

export interface PpopjRow {
  employeeNumber: string;
  employeeName: string;
  jmbg: string;
  brutoPrihod: number;
  neoporezivi: number;
  poreskaOsnovica: number;
  porez: number;
  pioZaposleni: number;
  zdravstvoZaposleni: number;
  nezaposlenost: number;
  pioPoslodavac: number;
  zdravstvoPoslodavac: number;
  ukupnoDoprinosiZaposleni: number;
  ukupnoDoprinosiPoslodavac: number;
  netoPrihod: number;
}

export interface PpopjPdfOptions {
  companyName: string;
  companyPib: string;
  companyAddress: string;
  year: number;
  rows: PpopjRow[];
}

/**
 * PPOPJ - Potvrda o plaćenom porezu i doprinosima - godišnji pregled svih zaposlenih
 */
export async function generatePpopjPdf(options: PpopjPdfOptions): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  doc.setFontSize(13);
  doc.text("PPOPJ - Pregled plaćenih poreza i doprinosa po zaposlenima", 148, 15, { align: "center" });

  doc.setFontSize(10);
  doc.text(`${options.companyName}  |  PIB: ${options.companyPib}  |  ${options.year}. godina`, 148, 22, { align: "center" });

  doc.setFontSize(8);
  doc.text(`Datum štampe: ${format(new Date(), "dd.MM.yyyy")}`, 14, 28);

  const tableData = options.rows.map((r, idx) => [
    String(idx + 1),
    r.employeeNumber,
    r.employeeName,
    r.jmbg,
    formatPrice(r.brutoPrihod),
    formatPrice(r.neoporezivi),
    formatPrice(r.poreskaOsnovica),
    formatPrice(r.porez),
    formatPrice(r.pioZaposleni),
    formatPrice(r.zdravstvoZaposleni),
    formatPrice(r.nezaposlenost),
    formatPrice(r.pioPoslodavac),
    formatPrice(r.zdravstvoPoslodavac),
    formatPrice(r.netoPrihod),
  ]);

  const totals = options.rows.reduce(
    (acc, r) => ({
      bruto: acc.bruto + r.brutoPrihod,
      neo: acc.neo + r.neoporezivi,
      osn: acc.osn + r.poreskaOsnovica,
      porez: acc.porez + r.porez,
      pioZ: acc.pioZ + r.pioZaposleni,
      zdZ: acc.zdZ + r.zdravstvoZaposleni,
      nez: acc.nez + r.nezaposlenost,
      pioP: acc.pioP + r.pioPoslodavac,
      zdP: acc.zdP + r.zdravstvoPoslodavac,
      neto: acc.neto + r.netoPrihod,
    }),
    { bruto: 0, neo: 0, osn: 0, porez: 0, pioZ: 0, zdZ: 0, nez: 0, pioP: 0, zdP: 0, neto: 0 }
  );

  autoTable(doc, {
    startY: 32,
    head: [["R.b.", "Šifra", "Ime i prezime", "JMBG", "Bruto", "Neoporz.", "Osn.porez", "Porez", "PIO z.", "Zdr. z.", "Nezap.", "PIO p.", "Zdr. p.", "Neto"]],
    body: tableData,
    foot: [
      [
        "", "", `Ukupno (${options.rows.length})`, "",
        formatPrice(totals.bruto), formatPrice(totals.neo), formatPrice(totals.osn),
        formatPrice(totals.porez), formatPrice(totals.pioZ), formatPrice(totals.zdZ),
        formatPrice(totals.nez), formatPrice(totals.pioP), formatPrice(totals.zdP),
        formatPrice(totals.neto),
      ],
    ],
    styles: { font: "DejaVuSans", fontSize: 7 },
    headStyles: { fillColor: [41, 128, 185] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 14 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 26 },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 18, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 20, halign: "right" },
      8: { cellWidth: 18, halign: "right" },
      9: { cellWidth: 18, halign: "right" },
      10: { cellWidth: 16, halign: "right" },
      11: { cellWidth: 18, halign: "right" },
      12: { cellWidth: 18, halign: "right" },
      13: { cellWidth: 22, halign: "right" },
    },
  });

  return doc;
}
