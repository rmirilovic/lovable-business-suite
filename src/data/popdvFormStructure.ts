/**
 * POPDV Form Structure - Official Serbian VAT evidence form
 * "Pregled obračuna PDV" (POPDV) - in effect from July 1, 2021
 * 13 sections: 1, 2, 3, 3a, 4, 5, 6, 7, 8 (8a-8đ), 8e, 9, 9a, 10, 11
 */

export interface PopdvColumn {
  code: string;
  label: string;
}

export interface PopdvRow {
  code: string;
  label: string;
  columns: PopdvColumn[];
  isSummary?: boolean;
  summaryOf?: string[];
}

export interface PopdvSubTable {
  id: string;
  title?: string;
  columns: PopdvColumn[];
  rows: PopdvRow[];
}

export interface PopdvSection {
  id: string;
  title: string;
  description: string;
  subTables: PopdvSubTable[];
}

// Column presets
const singleCol: PopdvColumn[] = [
  { code: "iznos", label: "Naknada/vrednost" },
];

const singleIznos: PopdvColumn[] = [
  { code: "iznos", label: "Iznos" },
];

const fourCols: PopdvColumn[] = [
  { code: "opsta_osnov", label: "Opšta stopa - Osnovica" },
  { code: "opsta_pdv", label: "Opšta stopa - PDV" },
  { code: "posebna_osnov", label: "Posebna stopa - Osnovica" },
  { code: "posebna_pdv", label: "Posebna stopa - PDV" },
];

const twoPdvCols: PopdvColumn[] = [
  { code: "opsta_pdv", label: "Opšta stopa - PDV" },
  { code: "posebna_pdv", label: "Posebna stopa - PDV" },
];

const twoOsnovCols: PopdvColumn[] = [
  { code: "opsta_osnov", label: "Opšta stopa - Osnovica" },
  { code: "posebna_osnov", label: "Posebna stopa - Osnovica" },
];

const col7: PopdvColumn[] = [
  { code: "vrednost", label: "Vrednost dobara i usluga" },
  { code: "pdv_naknada", label: "PDV nadoknada" },
];

const turistCols: PopdvColumn[] = [
  { code: "osnov", label: "Utvrđivanje osnovice" },
  { code: "pdv", label: "PDV" },
];

const fourColsOsnovPdv: PopdvColumn[] = [
  { code: "opsta_osnov", label: "Opšta - Utvrđivanje osnovice" },
  { code: "posebna_osnov", label: "Posebna - Utvrđivanje osnovice" },
  { code: "opsta_pdv", label: "Opšta - PDV" },
  { code: "posebna_pdv", label: "Posebna - PDV" },
];

// Helper to create rows with default columns
function makeRows(codes: [string, string, boolean?, string[]?][], cols: PopdvColumn[]): PopdvRow[] {
  return codes.map(([code, label, isSummary, summaryOf]) => ({
    code,
    label,
    columns: cols,
    ...(isSummary ? { isSummary: true } : {}),
    ...(summaryOf ? { summaryOf: summaryOf as string[] } : {}),
  }));
}

export const POPDV_SECTIONS: PopdvSection[] = [
  // ── DEO 1 ──
  {
    id: "1",
    title: "Promet dobara i usluga za koji je propisano poresko oslobođenje sa pravom na odbitak prethodnog poreza",
    description: "Član 24. Zakona o PDV",
    subTables: [{
      id: "1",
      columns: singleCol,
      rows: makeRows([
        ["1.1", "Promet dobara koja se otpremaju u inostranstvo, uključujući i povećanje, odnosno smanjenje naknade za taj promet"],
        ["1.2", "Promet dobara koja se otpremaju na teritoriju AP Kosovo i Metohija, uključujući i povećanje, odnosno smanjenje naknade za taj promet"],
        ["1.3", "Promet dobara koja se unose u slobodnu zonu i promet dobara i usluga u slobodnoj zoni, uključujući i povećanje, odnosno smanjenje naknade za taj promet"],
        ["1.4", "Promet dobara i usluga, osim iz tač. 1.1 do 1.3, uključujući i povećanje, odnosno smanjenje naknade za taj promet"],
        ["1.5", "Ukupan promet (1.1+1.2+1.3+1.4)", true, ["1.1", "1.2", "1.3", "1.4"]],
        ["1.6", "Promet dobara i usluga bez naknade"],
        ["1.7", "Naknada ili deo naknade naplaćen pre izvršenog prometa (avans)"],
      ], singleCol),
    }],
  },

  // ── DEO 2 ──
  {
    id: "2",
    title: "Promet dobara i usluga za koji je propisano poresko oslobođenje bez prava na odbitak prethodnog poreza",
    description: "Član 25. Zakona o PDV",
    subTables: [{
      id: "2",
      columns: singleCol,
      rows: makeRows([
        ["2.1", "Promet novca i kapitala, usluge osiguranja i reosiguranja, uključujući i povećanje, odnosno smanjenje naknade za taj promet"],
        ["2.2", "Promet zemljišta i davanja u zakup zemljišta, uključujući i povećanje, odnosno smanjenje naknade za taj promet"],
        ["2.3", "Promet objekata, uključujući i povećanje, odnosno smanjenje naknade za taj promet"],
        ["2.4", "Promet dobara i usluga, osim iz tač. 2.1 do 2.3, uključujući i povećanje, odnosno smanjenje naknade za taj promet"],
        ["2.5", "Ukupan promet (2.1+2.2+2.3+2.4)", true, ["2.1", "2.2", "2.3", "2.4"]],
        ["2.6", "Promet dobara i usluga bez naknade"],
        ["2.7", "Naknada ili deo naknade naplaćen pre izvršenog prometa (avans)"],
      ], singleCol),
    }],
  },

  // ── DEO 3 ──
  {
    id: "3",
    title: "Oporezivi promet dobara i usluga koji vrši obveznik PDV i obračunati PDV",
    description: "Promet po opštoj i posebnoj stopi PDV",
    subTables: [{
      id: "3",
      columns: fourCols,
      rows: makeRows([
        ["3.1", "Prvi prenos prava raspolaganja na novoizgrađenim građevinskim objektima za koji je poreski dužnik obveznik PDV koji vrši taj promet"],
        ["3.2", "Promet za koji je poreski dužnik obveznik PDV koji vrši taj promet, osim iz tačke 3.1"],
        ["3.3", "Prenos prava raspolaganja na građevinskim objektima za koji obveznik PDV koji vrši taj promet nije poreski dužnik"],
        ["3.4", "Promet za koji obveznik PDV koji vrši taj promet nije poreski dužnik, osim iz tačke 3.3"],
        ["3.5", "Povećanje osnovice, odnosno PDV"],
        ["3.6", "Smanjenje osnovice, odnosno PDV"],
        ["3.7", "Promet dobara i usluga bez naknade"],
        ["3.8", "Ukupna osnovica i obračunati PDV za promet dobara i usluga (3.1+3.2+3.3+3.4+3.5+3.6+3.7)", true, ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7"]],
        ["3.9", "Naknada ili deo naknade koji je naplaćen pre izvršenog prometa i PDV obračunat po tom osnovu (avans)"],
        ["3.10", "Ukupno obračunati PDV (3.8+3.9)", true, ["3.8", "3.9"]],
      ], fourCols),
    }],
  },

  // ── DEO 3a ──
  {
    id: "3a",
    title: "Obračunati PDV za promet drugog lica",
    description: "PDV koji obveznik obračunava kao poreski dužnik za promet drugog lica",
    subTables: [{
      id: "3a",
      columns: twoPdvCols,
      rows: makeRows([
        ["3a.1", "PDV za prenos prava raspolaganja na građevinskim objektima za koji je poreski dužnik primalac dobara"],
        ["3a.2", "PDV za nabavku dobara i usluga u Republici od stranih lica koja nisu obveznici PDV, za koje je poreski dužnik primalac dobara, odnosno usluga"],
        ["3a.3", "PDV za promet dobara i usluga za koji je poreski dužnik primalac dobara, odnosno usluga, osim iz tač. 3a.1 i 3a.2, uključujući i PDV obračunat u skladu sa članom 10. stav 4. Zakona"],
        ["3a.4", "Povećanje obračunatog PDV"],
        ["3a.5", "Smanjenje obračunatog PDV"],
        ["3a.6", "PDV za promet dobara i usluga bez naknade"],
        ["3a.7", "Ukupno obračunati PDV za promet dobara i usluga (3a.1+3a.2+3a.3+3a.4+3a.5+3a.6)", true, ["3a.1", "3a.2", "3a.3", "3a.4", "3a.5", "3a.6"]],
        ["3a.8", "PDV po osnovu naknade ili dela naknade koji je plaćen pre izvršenog prometa (avans)"],
        ["3a.9", "Ukupno obračunati PDV (3a.7+3a.8)", true, ["3a.7", "3a.8"]],
      ], twoPdvCols),
    }],
  },

  // ── DEO 4 ──
  {
    id: "4",
    title: "Posebni postupci oporezivanja",
    description: "Turističke agencije, polovna dobra, umetnička dela, kolekcionarstva, antikviteti",
    subTables: [
      {
        id: "4.1",
        title: "4.1 Turističke agencije",
        columns: turistCols,
        rows: makeRows([
          ["4.1.1", "Naknada koju plaća putnik, uključujući i povećanje, odnosno smanjenje te naknade"],
          ["4.1.2", "Sredstva uložena, uključujući i povećanje, odnosno smanjenje tih troškova"],
          ["4.1.3", "Razlika (4.1.1 - 4.1.2)", true, ["4.1.1", "4.1.2"]],
          ["4.1.4", "Obračunati PDV"],
        ], turistCols),
      },
      {
        id: "4.2",
        title: "4.2 Polovna dobra, umetnička dela, kolekcionarstva i antikviteti",
        columns: fourColsOsnovPdv,
        rows: makeRows([
          ["4.2.1", "Prodajna cena dobara, uključujući i povećanje, odnosno smanjenje te cene"],
          ["4.2.2", "Nabavna cena dobara, uključujući i povećanje, odnosno smanjenje te cene"],
          ["4.2.3", "Razlika (4.2.1 - 4.2.2)", true, ["4.2.1", "4.2.2"]],
          ["4.2.4", "Obračunati PDV"],
        ], fourColsOsnovPdv),
      },
    ],
  },

  // ── DEO 5 ──
  {
    id: "5",
    title: "Ukupan promet dobara i usluga i ukupno obračunati PDV",
    description: "Sumarni pregled prometa i obračunatog PDV",
    subTables: [{
      id: "5",
      columns: singleIznos,
      rows: makeRows([
        ["5.1", "Ukupan oporezivi promet dobara i usluga po opštoj stopi PDV (3.8+4.1.1+4.2.1)", true, ["3.8", "4.1.1", "4.2.1"]],
        ["5.2", "Ukupno obračunati PDV po opštoj stopi PDV (3.10+3a.9+4.1.4+4.2.4)", true, ["3.10", "3a.9", "4.1.4", "4.2.4"]],
        ["5.3", "Ukupno obračunati PDV po opštoj stopi PDV uvećan za iznos iz tačke 8e.6 (5.2+(8e.6 u apsolutnom iznosu))", true, ["5.2", "8e.6"]],
        ["5.4", "Ukupan oporezivi promet dobara i usluga po posebnoj stopi PDV (3.8+4.2.1)", true, ["3.8", "4.2.1"]],
        ["5.5", "Ukupno obračunati PDV po posebnoj stopi PDV (3.10+3a.9+4.2.4)", true, ["3.10", "3a.9", "4.2.4"]],
        ["5.6", "Ukupan promet dobara i usluga (1.5+2.5+5.1+5.4)", true, ["1.5", "2.5", "5.1", "5.4"]],
        ["5.7", "Ukupno obračunati PDV (5.3+5.5)", true, ["5.3", "5.5"]],
      ], singleIznos),
    }],
  },

  // ── DEO 6 ──
  {
    id: "6",
    title: "Uvoz dobara stavljenih u slobodan promet u skladu sa carinskim propisima",
    description: "Vrednost uvezenih dobara i PDV plaćen pri uvozu",
    subTables: [
      {
        id: "6.1",
        title: "Dobra sa poreskim oslobođenjem",
        columns: singleCol,
        rows: makeRows([
          ["6.1", "Vrednost dobara za čiji je uvoz propisano poresko oslobođenje, uključujući i povećanje, odnosno smanjenje vrednosti tih dobara"],
        ], singleCol),
      },
      {
        id: "6.2",
        title: "Uvoz dobara na koji se plaća PDV",
        columns: twoOsnovCols,
        rows: makeRows([
          ["6.2.1", "Osnovica za uvoz dobara"],
          ["6.2.2", "Povećanje osnovice za uvoz dobara"],
          ["6.2.3", "Smanjenje osnovice za uvoz dobara"],
        ], twoOsnovCols),
      },
      {
        id: "6.34",
        title: "Ukupna vrednost i PDV",
        columns: singleIznos,
        rows: makeRows([
          ["6.3", "Ukupna vrednost uvoza dobara (6.1+6.2.1+6.2.2+6.2.3)", true, ["6.1", "6.2.1", "6.2.2", "6.2.3"]],
          ["6.4", "Ukupan PDV plaćen pri uvozu dobara, a koji se može odbiti kao prethodni porez"],
        ], singleIznos),
      },
    ],
  },

  // ── DEO 7 ──
  {
    id: "7",
    title: "Nabavka dobara i usluga od poljoprivrednika",
    description: "PDV nadoknada za dobra i usluge nabavljene od poljoprivrednika",
    subTables: [{
      id: "7",
      columns: col7,
      rows: makeRows([
        ["7.1", "Vrednost nabavljenih dobara i usluga, uključujući i povećanje, odnosno smanjenje te vrednosti"],
        ["7.2", "Vrednost plaćenih dobara i usluga"],
        ["7.3", "Plaćena PDV nadoknada"],
        ["7.4", "PDV nadoknada u skladu sa zakonom"],
      ], col7),
    }],
  },

  // ── DEO 8 ──
  {
    id: "8",
    title: "Nabavka dobara i usluga, osim nabavke dobara i usluga od poljoprivrednika",
    description: "Pod-tabele 8a do 8đ",
    subTables: [
      // 8a
      {
        id: "8a",
        title: "8a Nabavka dobara i usluga u Republici od obveznika PDV - promet za koji je poreski dužnik isporučilac dobara, odnosno pružalac usluga",
        columns: fourCols,
        rows: makeRows([
          ["8a.1", "Prvi prenos prava raspolaganja na novoizgrađenim građevinskim objektima"],
          ["8a.2", "Dobra i usluge, osim dobara iz tačke 8a.1"],
          ["8a.3", "Dobra i usluge bez naknade"],
          ["8a.4", "Izmena osnovice za nabavljena dobra i usluge i ispravka PDV po osnovu izmene osnovice - povećanje"],
          ["8a.5", "Izmena osnovice za nabavljena dobra i usluge i ispravka PDV po osnovu izmene osnovice - smanjenje"],
          ["8a.6", "Ukupna osnovica za nabavljena dobra i usluge (8a.1+8a.2+8a.3+8a.4+8a.5)", true, ["8a.1", "8a.2", "8a.3", "8a.4", "8a.5"]],
          ["8a.7", "Naknada ili deo naknade koji je plaćen pre izvršenog prometa i PDV po tom osnovu (avans)"],
          ["8a.8", "Obračunati PDV - isporučilac, ukupno u prometu (8a.1+8a.2+8a.3+8a.4+8a.5+8a.7)", true, ["8a.1", "8a.2", "8a.3", "8a.4", "8a.5", "8a.7"]],
        ], fourCols),
      },
      // 8b
      {
        id: "8b",
        title: "8b Nabavka dobara i usluga u Republici od obveznika PDV - promet za koji je poreski dužnik primalac dobara, odnosno usluga",
        columns: twoOsnovCols,
        rows: makeRows([
          ["8b.1", "Prenos prava raspolaganja na građevinskim objektima"],
          ["8b.2", "Dobra i usluge, osim dobara iz tačke 8b.1"],
          ["8b.3", "Dobra i usluge bez naknade"],
          ["8b.4", "Izmena osnovice za nabavljena dobra i usluge - povećanje"],
          ["8b.5", "Izmena osnovice za nabavljena dobra i usluge - smanjenje"],
          ["8b.6", "Ukupna osnovica za nabavljena dobra i usluge (8b.1+8b.2+8b.3+8b.4+8b.5)", true, ["8b.1", "8b.2", "8b.3", "8b.4", "8b.5"]],
          ["8b.7", "Naknada ili deo naknade koji je plaćen pre izvršenog prometa (avans)"],
        ], twoOsnovCols),
      },
      // 8v
      {
        id: "8v",
        title: "8v Nabavka dobara i usluga u Republici od obveznika PDV, osim po osnovu prometa za koji postoji obaveza obračunavanja PDV iz tač. 8a i 8b",
        columns: singleCol,
        rows: makeRows([
          ["8v.1", "Nabavka u skladu sa čl. 6. st. 1. tač. 1) Zakona i nabavka dobara i usluga u slobodnoj zoni, sa plaćanjem, bez naknade, uključujući i povećanje, odnosno smanjenje naknade"],
          ["8v.2", "Dobra i usluge uz naknadu, osim iz tačke 8v.1, uključujući i povećanje, odnosno smanjenje naknade"],
          ["8v.3", "Dobra i usluge bez naknade, osim iz tačke 8v.1"],
          ["8v.4", "Ukupna naknada, odnosno vrednost nabavljenih dobara i usluga (8v.1+8v.2+8v.3)", true, ["8v.1", "8v.2", "8v.3"]],
        ], singleCol),
      },
      // 8g
      {
        id: "8g",
        title: "8g Nabavka dobara i usluga u Republici od stranih lica koja nisu obveznici PDV - promet za koji postoji obaveza obračunavanja PDV",
        columns: twoOsnovCols,
        rows: makeRows([
          ["8g.1", "Dobra i usluge"],
          ["8g.2", "Dobra i usluge bez naknade"],
          ["8g.3", "Izmena osnovice - povećanje"],
          ["8g.4", "Izmena osnovice - smanjenje"],
          ["8g.5", "Ukupna osnovica za nabavljena dobra i usluge (8g.1+8g.2+8g.3+8g.4)", true, ["8g.1", "8g.2", "8g.3", "8g.4"]],
          ["8g.6", "Naknada ili deo naknade koji je plaćen pre izvršenog prometa (avans)"],
        ], twoOsnovCols),
      },
      // 8d
      {
        id: "8d",
        title: "8d Nabavka dobara i usluga, osim iz tač. 8a do 8g",
        columns: singleCol,
        rows: makeRows([
          ["8d.1", "Od obveznika PDV - promet za koji ne postoji obaveza obračunavanja PDV, uključujući i povećanje, odnosno smanjenje naknade za ta dobra i usluge, uključujući i nabavku bez naknade"],
          ["8d.2", "Od stranih lica - promet za koji ne postoji obaveza obračunavanja PDV, uključujući i povećanje, odnosno smanjenje naknade, uključujući i nabavku bez naknade"],
          ["8d.3", "Od lica u Republici koja nisu obveznici PDV, uključujući i povećanje, odnosno smanjenje naknade za ta dobra i usluge, uključujući i nabavku bez naknade"],
        ], singleCol),
      },
      // 8đ
      {
        id: "8đ",
        title: "8đ Ukupna osnovica, naknada, odnosno vrednost nabavljenih dobara i usluga",
        columns: singleIznos,
        rows: makeRows([
          ["8đ", "Ukupno (8a.6+8b.6+8v.4+8g.5+8d.1+8d.2+8d.3)", true, ["8a.6", "8b.6", "8v.4", "8g.5", "8d.1", "8d.2", "8d.3"]],
        ], singleIznos),
      },
    ],
  },

  // ── DEO 8e ──
  {
    id: "8e",
    title: "PDV za promet dobara i usluga koji se može odbiti kao prethodni porez i ispravke odbitka prethodnog poreza",
    description: "Prethodni porez i ispravke",
    subTables: [{
      id: "8e",
      columns: singleIznos,
      rows: makeRows([
        ["8e.1", "Ukupan obračunati PDV za promet nabavljenih dobara i usluga za koji je poreski dužnik isporučilac, a koji se može odbiti kao prethodni porez (8a.8 u delu PDV koji se može odbiti)"],
        ["8e.2", "Ukupan obračunati PDV za promet nabavljenih dobara i usluga za koji je poreski dužnik primalac, a koji se može odbiti kao prethodni porez (3a.9 u delu PDV koji se može odbiti)"],
        ["8e.3", "Ispravka odbitka - povećanje prethodnog poreza, osim po osnovu izmene osnovice za promet dobara i usluga po osnovu ulaganja u dobra"],
        ["8e.4", "Ispravka odbitka - smanjenje prethodnog poreza, osim po osnovu izmene osnovice za promet dobara i usluga po osnovu ulaganja u dobra"],
        ["8e.5", "Ukupan prethodni porez za nabavljena dobra i usluge (8e.1+8e.2+8e.3+8e.4)", true, ["8e.1", "8e.2", "8e.3", "8e.4"]],
        ["8e.6", "Ukupan prethodni porez u skladu sa srazmernim odbitkom (8e.5+(5.2+5.5 u apsolutnom iznosu))", true, ["8e.5"]],
      ], singleIznos),
    }],
  },

  // ── DEO 9 ──
  {
    id: "9",
    title: "Ukupna vrednost nabavljenih dobara i usluga, uključujući i uvoz dobara stavljenih u slobodan promet",
    description: "6.3+7.1+8đ",
    subTables: [{
      id: "9",
      columns: singleIznos,
      rows: makeRows([
        ["9", "Ukupna vrednost (6.3+7.1+8đ)", true, ["6.3", "7.1", "8đ"]],
      ], singleIznos),
    }],
  },

  // ── DEO 9a ──
  {
    id: "9a",
    title: "PDV koji se u poreskoj prijavi iskazuje kao prethodni porez",
    description: "Prethodni porez za poresku prijavu",
    subTables: [{
      id: "9a",
      columns: singleIznos,
      rows: makeRows([
        ["9a.1", "PDV plaćen pri uvozu dobara"],
        ["9a.2", "PDV nadoknada"],
        ["9a.3", "PDV po osnovu nabavke dobara i usluga, osim iz tač. 9a.1 i 9a.2"],
        ["9a.4", "Ukupan prethodni porez (9a.1+9a.2+9a.3)", true, ["9a.1", "9a.2", "9a.3"]],
      ], singleIznos),
    }],
  },

  // ── DEO 10 ──
  {
    id: "10",
    title: "Poreska obaveza (5.7 - 9a.4)",
    description: "Razlika između obračunatog PDV i prethodnog poreza",
    subTables: [{
      id: "10",
      columns: singleIznos,
      rows: makeRows([
        ["10", "Poreska obaveza (5.7 - 9a.4)", true, ["5.7", "9a.4"]],
      ], singleIznos),
    }],
  },

  // ── DEO 11 ──
  {
    id: "11",
    title: "Promet dobara i usluga izvršen van Republike i drugi promet koji ne podleže PDV",
    description: "Promet koji nije predmet oporezivanja PDV",
    subTables: [{
      id: "11",
      columns: singleIznos,
      rows: makeRows([
        ["11.1", "Promet usluga izvršen van Republike, sa pravom na odbitak prethodnog poreza"],
        ["11.2", "Promet nepokretnosti u skladu sa čl. 6. st. 1. tač. 1) Zakona i usluga u vezi sa tim nepokretnostima, sa plaćanjem bez naknade"],
        ["11.3", "Promet dobara i usluga iz člana 6. Zakona, osim iz tačke 11.2"],
      ], singleIznos),
    }],
  },
];

/**
 * Get all unique (section, rowCode, columnCode) triples for initializing empty cells
 */
export function getAllCellKeys(): { section: string; rowCode: string; columnCode: string }[] {
  const keys: { section: string; rowCode: string; columnCode: string }[] = [];
  for (const section of POPDV_SECTIONS) {
    for (const subTable of section.subTables) {
      for (const row of subTable.rows) {
        for (const col of row.columns) {
          keys.push({ section: section.id, rowCode: row.code, columnCode: col.code });
        }
      }
    }
  }
  return keys;
}
