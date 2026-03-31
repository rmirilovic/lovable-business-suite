import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { configurePdfFonts, initializePdfFonts } from "./pdfFonts";
import { formatPrice } from "./formatting";
import { format } from "date-fns";

const MONTH_NAMES = ["Januar", "Februar", "Mart", "April", "Maj", "Jun", "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

export interface PppPdPdfRow {
  redBr: number;
  jmbg: string;
  imePrezime: string;
  sifraVrstePrihoda: string;
  brutoPrihod: number;
  osnovicaZaPorez: number;
  porez: number;
  pioZaposleni: number;
  zdravstvoZaposleni: number;
  nezaposlenost: number;
  pioPoslodavac: number;
  zdravstvoPoslodavac: number;
}

export interface PppPdPdfOptions {
  rows: PppPdPdfRow[];
  companyName: string;
  companyPib: string;
  datumPlacanja: string;
  periodMonth: number;
  periodYear: number;
  calculationType: string;
  calculationNumber: string;
}

const CALC_TYPE_LABELS: Record<string, string> = {
  redovna_zarada: "Redovna zarada",
  bolovanje_poslodavac: "Bolovanje na teret poslodavca",
  bolovanje_rfzo: "Bolovanje na teret RFZO",
  ugovor_o_delu: "Ugovor o delu",
  autorski_ugovor: "Autorski ugovor",
  vlasnik: "Vlasnik",
  penzioner: "Penzioner",
};

export async function generatePppPdPdf(options: PppPdPdfOptions): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "landscape" });
  configurePdfFonts(doc);

  // Header
  doc.setFontSize(14);
  doc.text("PPP-PD - Pojedinačna poreska prijava", 14, 15);

  doc.setFontSize(10);
  doc.text(options.companyName, 14, 22);

  doc.setFontSize(9);
  const meta: string[] = [];
  meta.push(`PIB: ${options.companyPib}`);
  meta.push(`Obračun: ${options.calculationNumber}`);
  meta.push(`Tip: ${CALC_TYPE_LABELS[options.calculationType] || options.calculationType}`);
  meta.push(`Period: ${MONTH_NAMES[options.periodMonth - 1]} ${options.periodYear}`);
  if (options.datumPlacanja) {
    meta.push(`Datum plaćanja: ${format(new Date(options.datumPlacanja), "dd.MM.yyyy")}`);
  }
  doc.text(meta.join("   |   "), 14, 28);
  doc.text(`Datum štampe: ${format(new Date(), "dd.MM.yyyy")}`, 14, 33);

  const tableData = options.rows.map((r) => [
    String(r.redBr),
    r.jmbg,
    r.imePrezime,
    r.sifraVrstePrihoda,
    formatPrice(r.brutoPrihod),
    formatPrice(r.osnovicaZaPorez),
    formatPrice(r.porez),
    formatPrice(r.pioZaposleni),
    formatPrice(r.zdravstvoZaposleni),
    formatPrice(r.nezaposlenost),
    formatPrice(r.pioPoslodavac),
    formatPrice(r.zdravstvoPoslodavac),
  ]);

  const totals = options.rows.reduce(
    (acc, r) => ({
      bruto: acc.bruto + r.brutoPrihod,
      osnovica: acc.osnovica + r.osnovicaZaPorez,
      porez: acc.porez + r.porez,
      pioZ: acc.pioZ + r.pioZaposleni,
      zdZ: acc.zdZ + r.zdravstvoZaposleni,
      nez: acc.nez + r.nezaposlenost,
      pioP: acc.pioP + r.pioPoslodavac,
      zdP: acc.zdP + r.zdravstvoPoslodavac,
    }),
    { bruto: 0, osnovica: 0, porez: 0, pioZ: 0, zdZ: 0, nez: 0, pioP: 0, zdP: 0 }
  );

  autoTable(doc, {
    startY: 37,
    head: [["R.b.", "JMBG", "Ime i prezime", "Šifra", "Bruto", "Osn. porez", "Porez", "PIO zap.", "Zdr. zap.", "Nezap.", "PIO posl.", "Zdr. posl."]],
    body: tableData,
    foot: [
      [
        "",
        "",
        `Ukupno (${options.rows.length})`,
        "",
        formatPrice(totals.bruto),
        formatPrice(totals.osnovica),
        formatPrice(totals.porez),
        formatPrice(totals.pioZ),
        formatPrice(totals.zdZ),
        formatPrice(totals.nez),
        formatPrice(totals.pioP),
        formatPrice(totals.zdP),
      ],
    ],
    styles: { font: "DejaVuSans", fontSize: 7 },
    headStyles: { fillColor: [41, 128, 185] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 28 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 22 },
      4: { cellWidth: 24, halign: "right" },
      5: { cellWidth: 24, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 22, halign: "right" },
      8: { cellWidth: 22, halign: "right" },
      9: { cellWidth: 20, halign: "right" },
      10: { cellWidth: 22, halign: "right" },
      11: { cellWidth: 22, halign: "right" },
    },
  });

  return doc;
}
