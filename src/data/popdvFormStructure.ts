/**
 * POPDV Form Structure - all 11 sections with rows and columns
 * Based on Serbian tax form "Pregled obračuna PDV" (POPDV)
 */

export interface PopdvRow {
  code: string;       // e.g. "1.1", "1.2"
  label: string;
  columns: PopdvColumn[];
  isSummary?: boolean; // auto-calculated from other rows
  summaryOf?: string[]; // row codes to sum
}

export interface PopdvColumn {
  code: string;        // "osnov", "pdv"
  label: string;
  editable?: boolean;  // default true for non-summary rows
}

export interface PopdvSection {
  number: number;
  title: string;
  description: string;
  rows: PopdvRow[];
  autoPopulate?: boolean; // can be auto-filled from documents
}

const standardColumns: PopdvColumn[] = [
  { code: "osnov", label: "Osnovica" },
  { code: "pdv", label: "PDV" },
];

const singleColumn: PopdvColumn[] = [
  { code: "iznos", label: "Iznos" },
];

export const POPDV_SECTIONS: PopdvSection[] = [
  // DEO 1: Promet dobara i usluga koji se oporezuje po opštoj/posebnoj stopi
  {
    number: 1,
    title: "Promet dobara i usluga za koji je propisano oporezivanje",
    description: "Promet dobara i usluga koji se oporezuje PDV-om",
    autoPopulate: true,
    rows: [
      { code: "1.1", label: "Promet po opštoj stopi (20%)", columns: standardColumns },
      { code: "1.2", label: "Promet po posebnoj stopi (10%)", columns: standardColumns },
      { code: "1.3", label: "Promet po stopi 0% sa pravom na odbitak", columns: singleColumn },
      { code: "1.4", label: "Promet oslobođen bez prava na odbitak", columns: singleColumn },
      { code: "1.5", label: "Ukupan promet (1.1+1.2+1.3+1.4)", columns: standardColumns, isSummary: true, summaryOf: ["1.1", "1.2", "1.3", "1.4"] },
      { code: "1.6", label: "Avansna plaćanja - opšta stopa", columns: standardColumns },
      { code: "1.7", label: "Avansna plaćanja - posebna stopa", columns: standardColumns },
      { code: "1.8", label: "Ukupna avansna plaćanja (1.6+1.7)", columns: standardColumns, isSummary: true, summaryOf: ["1.6", "1.7"] },
    ],
  },
  // DEO 2: Promet dobara i usluga izvršen bez naknade
  {
    number: 2,
    title: "Promet dobara i usluga izvršen bez naknade",
    description: "Promet bez naknade koji se izjednačava sa prometom uz naknadu",
    autoPopulate: false,
    rows: [
      { code: "2.1", label: "Po opštoj stopi (20%)", columns: standardColumns },
      { code: "2.2", label: "Po posebnoj stopi (10%)", columns: standardColumns },
      { code: "2.3", label: "Ukupno (2.1+2.2)", columns: standardColumns, isSummary: true, summaryOf: ["2.1", "2.2"] },
    ],
  },
  // DEO 3: Uvoz dobara
  {
    number: 3,
    title: "Uvoz dobara",
    description: "PDV obračunat na uvoz dobara",
    autoPopulate: true,
    rows: [
      { code: "3.1", label: "Uvoz po opštoj stopi (20%)", columns: standardColumns },
      { code: "3.2", label: "Uvoz po posebnoj stopi (10%)", columns: standardColumns },
      { code: "3.3", label: "Uvoz oslobođen PDV-a", columns: singleColumn },
      { code: "3.4", label: "Ukupan uvoz (3.1+3.2+3.3)", columns: standardColumns, isSummary: true, summaryOf: ["3.1", "3.2", "3.3"] },
    ],
  },
  // DEO 4: Nabavke od poljoprivrednika
  {
    number: 4,
    title: "Nabavke od poljoprivrednika",
    description: "PDV nadoknada za dobra i usluge nabavljene od poljoprivrednika",
    autoPopulate: false,
    rows: [
      { code: "4.1", label: "Nabavke dobara od poljoprivrednika", columns: [{ code: "naknada", label: "Naknada" }, { code: "pdv_naknada", label: "PDV nadoknada (8%)" }] },
      { code: "4.2", label: "Nabavke usluga od poljoprivrednika", columns: [{ code: "naknada", label: "Naknada" }, { code: "pdv_naknada", label: "PDV nadoknada (8%)" }] },
      { code: "4.3", label: "Ukupno (4.1+4.2)", columns: [{ code: "naknada", label: "Naknada" }, { code: "pdv_naknada", label: "PDV nadoknada" }], isSummary: true, summaryOf: ["4.1", "4.2"] },
    ],
  },
  // DEO 5: Prethodni porez
  {
    number: 5,
    title: "Prethodni porez",
    description: "PDV koji se može odbiti kao prethodni porez",
    autoPopulate: true,
    rows: [
      { code: "5.1", label: "PDV iz računa za nabavku dobara - opšta stopa", columns: standardColumns },
      { code: "5.2", label: "PDV iz računa za nabavku dobara - posebna stopa", columns: standardColumns },
      { code: "5.3", label: "PDV iz računa za nabavku usluga - opšta stopa", columns: standardColumns },
      { code: "5.4", label: "PDV iz računa za nabavku usluga - posebna stopa", columns: standardColumns },
      { code: "5.5", label: "PDV plaćen pri uvozu - opšta stopa", columns: standardColumns },
      { code: "5.6", label: "PDV plaćen pri uvozu - posebna stopa", columns: standardColumns },
      { code: "5.7", label: "PDV nadoknada plaćena poljoprivrednicima", columns: singleColumn },
      { code: "5.8", label: "Ukupan prethodni porez (5.1 do 5.7)", columns: standardColumns, isSummary: true, summaryOf: ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"] },
    ],
  },
  // DEO 6: Ispravke prethodnig poreza
  {
    number: 6,
    title: "Ispravke prethodnog poreza",
    description: "Povećanja i smanjenja prethodnog poreza",
    autoPopulate: true,
    rows: [
      { code: "6.1", label: "Povećanje prethodnog poreza", columns: singleColumn },
      { code: "6.2", label: "Smanjenje prethodnog poreza", columns: singleColumn },
      { code: "6.3", label: "Neto ispravka (6.1-6.2)", columns: singleColumn, isSummary: true, summaryOf: ["6.1", "6.2"] },
    ],
  },
  // DEO 7: PDV za promet koji vrše strana lica
  {
    number: 7,
    title: "PDV za promet stranih lica",
    description: "PDV koji obveznik obračunava kao poreski dužnik za promet stranih lica",
    autoPopulate: false,
    rows: [
      { code: "7.1", label: "Promet dobara stranog lica - opšta stopa", columns: standardColumns },
      { code: "7.2", label: "Promet dobara stranog lica - posebna stopa", columns: standardColumns },
      { code: "7.3", label: "Promet usluga stranog lica - opšta stopa", columns: standardColumns },
      { code: "7.4", label: "Promet usluga stranog lica - posebna stopa", columns: standardColumns },
      { code: "7.5", label: "Ukupno (7.1 do 7.4)", columns: standardColumns, isSummary: true, summaryOf: ["7.1", "7.2", "7.3", "7.4"] },
    ],
  },
  // DEO 8: Posebni postupci oporezivanja
  {
    number: 8,
    title: "Posebni postupci oporezivanja",
    description: "Turističke agencije, polovna dobra, umetničke predmeti itd.",
    autoPopulate: false,
    rows: [
      { code: "8.1", label: "Promet u okviru posebnog postupka - turistička agencija", columns: standardColumns },
      { code: "8.2", label: "Promet u okviru posebnog postupka - polovna dobra", columns: standardColumns },
      { code: "8.3", label: "Promet u okviru posebnog postupka - umetničke predmeti", columns: standardColumns },
      { code: "8.4", label: "Ukupno (8.1 do 8.3)", columns: standardColumns, isSummary: true, summaryOf: ["8.1", "8.2", "8.3"] },
    ],
  },
  // DEO 9: Ukupan promet i PDV obaveza
  {
    number: 9,
    title: "Ukupan obračunati PDV i poreska obaveza",
    description: "Sumarni pregled - obračunati PDV minus prethodni porez",
    autoPopulate: true,
    rows: [
      { code: "9.1", label: "Ukupan obračunati PDV (1.5 + 2.3 + 7.5 + 8.4)", columns: [{ code: "pdv", label: "PDV" }], isSummary: true, summaryOf: ["1.5", "2.3", "7.5", "8.4"] },
      { code: "9.2", label: "Ukupan prethodni porez (5.8 + 6.3)", columns: [{ code: "pdv", label: "PDV" }], isSummary: true, summaryOf: ["5.8", "6.3"] },
      { code: "9.3", label: "PDV obaveza (9.1 - 9.2)", columns: [{ code: "pdv", label: "PDV" }], isSummary: true, summaryOf: ["9.1", "9.2"] },
    ],
  },
  // DEO 10: Podatak o prometu nekretnina
  {
    number: 10,
    title: "Promet nepokretnosti",
    description: "Prvi prenos prava raspolaganja na nepokretnostima",
    autoPopulate: false,
    rows: [
      { code: "10.1", label: "Prvi prenos prava raspolaganja na novoizgrađenim objektima", columns: standardColumns },
      { code: "10.2", label: "Promet nepokretnosti - ekonomski deljiva celina", columns: standardColumns },
      { code: "10.3", label: "Ukupno (10.1+10.2)", columns: standardColumns, isSummary: true, summaryOf: ["10.1", "10.2"] },
    ],
  },
  // DEO 11: Kontrolni podaci
  {
    number: 11,
    title: "Kontrolni podaci",
    description: "Podaci za kontrolu ispravnosti obrasca",
    autoPopulate: true,
    rows: [
      { code: "11.1", label: "Ukupan promet (sa PDV-om)", columns: singleColumn, isSummary: true },
      { code: "11.2", label: "Ukupan prethodni porez", columns: singleColumn, isSummary: true },
      { code: "11.3", label: "Razlika (PDV obaveza ili pretplata)", columns: singleColumn, isSummary: true },
    ],
  },
];

/**
 * Get all unique (row_code, column_code) pairs for initializing empty cells
 */
export function getAllCellKeys(): { rowCode: string; columnCode: string; section: number }[] {
  const keys: { rowCode: string; columnCode: string; section: number }[] = [];
  for (const section of POPDV_SECTIONS) {
    for (const row of section.rows) {
      for (const col of row.columns) {
        keys.push({ rowCode: row.code, columnCode: col.code, section: section.number });
      }
    }
  }
  return keys;
}
