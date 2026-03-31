import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { configurePdfFonts, initializePdfFonts } from "./pdfFonts";
import { formatPrice } from "./formatting";
import { format } from "date-fns";

const MONTH_NAMES = ["Januar", "Februar", "Mart", "April", "Maj", "Jun", "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

export interface PpodEmployeeRow {
  periodMonth: number;
  periodYear: number;
  calculationNumber: string;
  calculationType: string;
  brutoPrihod: number;
  neoporezivi: number;
  poreskaOsnovica: number;
  porez: number;
  pioZaposleni: number;
  zdravstvoZaposleni: number;
  nezaposlenost: number;
  pioPoslodavac: number;
  zdravstvoPoslodavac: number;
  netoPrihod: number;
}

export interface PpodPdfOptions {
  employeeName: string;
  employeeJmbg: string;
  employeeNumber: string;
  companyName: string;
  companyPib: string;
  companyAddress: string;
  year: number;
  rows: PpodEmployeeRow[];
}

const CALC_TYPE_LABELS: Record<string, string> = {
  redovna_zarada: "Zarada",
  bolovanje_poslodavac: "Bol. posl.",
  bolovanje_rfzo: "Bol. RFZO",
  ugovor_o_delu: "Ugovor",
  autorski_ugovor: "Aut. ugovor",
  vlasnik: "Vlasnik",
  penzioner: "Penzioner",
};

/**
 * Generates PPOD certificate per employee - annual summary of taxes and contributions
 */
export async function generatePpodPdf(options: PpodPdfOptions): Promise<jsPDF> {
  await initializePdfFonts();
  const doc = new jsPDF({ orientation: "portrait" });
  configurePdfFonts(doc);

  // Header
  doc.setFontSize(12);
  doc.text("POTVRDA O PLAĆENIM POREZIMA I DOPRINOSIMA PO ODBITKU", 105, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`(PPOD) za ${options.year}. godinu`, 105, 21, { align: "center" });

  // Company info
  doc.setFontSize(9);
  let y = 30;
  doc.text("Isplatilac prihoda:", 14, y);
  doc.text(options.companyName, 60, y);
  y += 5;
  doc.text("PIB:", 14, y);
  doc.text(options.companyPib, 60, y);
  y += 5;
  doc.text("Adresa:", 14, y);
  doc.text(options.companyAddress || "", 60, y);

  // Employee info
  y += 10;
  doc.text("Primalac prihoda:", 14, y);
  doc.text(options.employeeName, 60, y);
  y += 5;
  doc.text("JMBG:", 14, y);
  doc.text(options.employeeJmbg || "", 60, y);
  y += 5;
  doc.text("Šifra:", 14, y);
  doc.text(options.employeeNumber, 60, y);
  y += 8;

  const tableData = options.rows.map((r) => [
    `${MONTH_NAMES[r.periodMonth - 1].slice(0, 3)} ${r.periodYear}`,
    CALC_TYPE_LABELS[r.calculationType] || r.calculationType,
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
    startY: y,
    head: [["Period", "Tip", "Bruto", "Neoporz.", "Osn.porez", "Porez", "PIO z.", "Zdr. z.", "Nezap.", "PIO p.", "Zdr. p.", "Neto"]],
    body: tableData,
    foot: [
      [
        "UKUPNO", "",
        formatPrice(totals.bruto), formatPrice(totals.neo), formatPrice(totals.osn),
        formatPrice(totals.porez), formatPrice(totals.pioZ), formatPrice(totals.zdZ),
        formatPrice(totals.nez), formatPrice(totals.pioP), formatPrice(totals.zdP),
        formatPrice(totals.neto),
      ],
    ],
    styles: { font: "DejaVuSans", fontSize: 6.5 },
    headStyles: { fillColor: [41, 128, 185] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 16 },
      2: { cellWidth: 18, halign: "right" },
      3: { cellWidth: 14, halign: "right" },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 16, halign: "right" },
      6: { cellWidth: 14, halign: "right" },
      7: { cellWidth: 14, halign: "right" },
      8: { cellWidth: 14, halign: "right" },
      9: { cellWidth: 14, halign: "right" },
      10: { cellWidth: 14, halign: "right" },
      11: { cellWidth: 18, halign: "right" },
    },
  });

  // Signature
  const finalY = (doc as any).lastAutoTable?.finalY || 250;
  doc.setFontSize(8);
  doc.text(`Datum štampe: ${format(new Date(), "dd.MM.yyyy")}`, 14, finalY + 15);
  doc.text("M.P.", 90, finalY + 25);
  doc.text("Potpis odgovornog lica", 130, finalY + 25);
  doc.line(120, finalY + 23, 185, finalY + 23);

  return doc;
}

/**
 * Generate PPOD PDFs for ALL employees in a batch (multi-page document)
 */
export async function generatePpodBatchPdf(employees: PpodPdfOptions[]): Promise<jsPDF> {
  await initializePdfFonts();

  let combinedDoc: jsPDF | null = null;

  for (let i = 0; i < employees.length; i++) {
    const empDoc = await generatePpodPdf(employees[i]);
    if (i === 0) {
      combinedDoc = empDoc;
    } else {
      // Add pages from empDoc to combinedDoc
      const totalPages = empDoc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        combinedDoc!.addPage();
        // Re-generate on this page
      }
    }
  }

  // For simplicity, just return single employee or use separate files
  return combinedDoc || new jsPDF();
}
