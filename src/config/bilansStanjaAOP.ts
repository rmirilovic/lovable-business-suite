/**
 * Bilans stanja – AOP pozicije prema Pravilniku o sadržini i formi obrazaca
 * finansijskih izveštaja za privredna društva (RS).
 *
 * Svaka pozicija definiše:
 *  - aop: redni broj AOP pozicije
 *  - label: naziv pozicije
 *  - accountRanges: opsezi konta čiji se saldo sabira
 *  - formula: alternativno, računa se iz drugih AOP pozicija
 *  - bold / indent / separator: stilski flagovi
 *  - sign: "debit" (aktivna – duguje minus potražuje) ili "credit" (pasivna – potražuje minus duguje)
 */

export interface BsAopPosition {
  aop: number;
  label: string;
  accountRanges?: [string, string][];
  formula?: { plus?: number[]; minus?: number[] };
  sign?: "debit" | "credit";
  bold?: boolean;
  indent?: number;
  separator?: boolean;
  sectionHeader?: boolean;
}

export const bilansStanjaPositions: BsAopPosition[] = [
  // ═══════════════════════════════════════════
  // AKTIVA
  // ═══════════════════════════════════════════
  { aop: 1, label: "AKTIVA", formula: { plus: [2, 39, 44, 45] }, sign: "debit", bold: true, sectionHeader: true, separator: true },

  // ── A. STALNA IMOVINA ──
  { aop: 2, label: "A. STALNA IMOVINA (3+4+10+16+20+24)", formula: { plus: [3, 4, 10, 16, 20, 24] }, sign: "debit", bold: true, sectionHeader: true },

  { aop: 3, label: "I. Neuplaćeni upisani kapital", accountRanges: [["00", "009"]], sign: "debit", indent: 1 },

  { aop: 4, label: "II. Nematerijalna imovina (5+6+7+8+9)", formula: { plus: [5, 6, 7, 8, 9] }, sign: "debit", bold: true, indent: 1 },
  { aop: 5, label: "1. Goodwill", accountRanges: [["012", "012"]], sign: "debit", indent: 2 },
  { aop: 6, label: "2. Koncesije, patenti, licence i slična prava", accountRanges: [["011", "011"]], sign: "debit", indent: 2 },
  { aop: 7, label: "3. Ostala nematerijalna imovina", accountRanges: [["013", "014"]], sign: "debit", indent: 2 },
  { aop: 8, label: "4. Nematerijalna imovina u pripremi", accountRanges: [["015", "015"]], sign: "debit", indent: 2 },
  { aop: 9, label: "5. Avansi za nematerijalnu imovinu", accountRanges: [["016", "019"]], sign: "debit", indent: 2 },

  { aop: 10, label: "III. Nekretnine, postrojenja i oprema (11+12+13+14+15)", formula: { plus: [11, 12, 13, 14, 15] }, sign: "debit", bold: true, indent: 1 },
  { aop: 11, label: "1. Zemljišta", accountRanges: [["020", "020"]], sign: "debit", indent: 2 },
  { aop: 12, label: "2. Građevinski objekti", accountRanges: [["021", "022"]], sign: "debit", indent: 2 },
  { aop: 13, label: "3. Postrojenja i oprema", accountRanges: [["023", "024"]], sign: "debit", indent: 2 },
  { aop: 14, label: "4. Nekret., postrojenja i oprema u pripremi", accountRanges: [["025", "026"]], sign: "debit", indent: 2 },
  { aop: 15, label: "5. Avansi za nekret., postrojenja i opremu", accountRanges: [["027", "029"]], sign: "debit", indent: 2 },

  { aop: 16, label: "IV. Biološka sredstva (17+18+19)", formula: { plus: [17, 18, 19] }, sign: "debit", bold: true, indent: 1 },
  { aop: 17, label: "1. Šume i višegodišnji zasadi", accountRanges: [["030", "031"]], sign: "debit", indent: 2 },
  { aop: 18, label: "2. Osnovno stado", accountRanges: [["032", "033"]], sign: "debit", indent: 2 },
  { aop: 19, label: "3. Biološka sredstva u pripremi i avansi", accountRanges: [["034", "039"]], sign: "debit", indent: 2 },

  { aop: 20, label: "V. Dugoročni finansijski plasmani (21+22+23)", formula: { plus: [21, 22, 23] }, sign: "debit", bold: true, indent: 1 },
  { aop: 21, label: "1. Učešća u kapitalu", accountRanges: [["040", "042"]], sign: "debit", indent: 2 },
  { aop: 22, label: "2. Ostali dugoročni finansijski plasmani", accountRanges: [["043", "048"]], sign: "debit", indent: 2 },
  { aop: 23, label: "3. Dugor. fin. plasm. - mat. preduzeće", accountRanges: [["049", "049"]], sign: "debit", indent: 2 },

  { aop: 24, label: "VI. Dugoročna potraživanja (25+26)", formula: { plus: [25, 26] }, sign: "debit", bold: true, indent: 1 },
  { aop: 25, label: "1. Potraživanja od prodaje na kredit", accountRanges: [["050", "052"]], sign: "debit", indent: 2 },
  { aop: 26, label: "2. Ostala dugoročna potraživanja", accountRanges: [["053", "059"]], sign: "debit", indent: 2 },

  // ── B. OBRTNA IMOVINA ──
  { aop: 27, label: "B. OBRTNA IMOVINA (28+32+33+34+35+36+37+38)", formula: { plus: [28, 32, 33, 34, 35, 36, 37, 38] }, sign: "debit", bold: true, sectionHeader: true },

  { aop: 28, label: "I. Zalihe (29+30+31)", formula: { plus: [29, 30, 31] }, sign: "debit", bold: true, indent: 1 },
  { aop: 29, label: "1. Materijal, rezev. delovi, alat i sitan inv.", accountRanges: [["10", "109"]], sign: "debit", indent: 2 },
  { aop: 30, label: "2. Nedovršena proizv. i nedovršene usluge", accountRanges: [["11", "119"], ["95", "959"]], sign: "debit", indent: 2 },
  { aop: 31, label: "3. Gotovi proizvodi i roba", accountRanges: [["12", "139"]], sign: "debit", indent: 2 },

  { aop: 32, label: "II. Stalna sredstva namenjena prodaji", accountRanges: [["14", "149"]], sign: "debit", indent: 1 },
  { aop: 33, label: "III. Dati avansi", accountRanges: [["15", "159"]], sign: "debit", indent: 1 },

  { aop: 34, label: "IV. Potraživanja po osnovu prodaje", accountRanges: [["20", "209"]], sign: "debit", indent: 1 },
  { aop: 35, label: "V. Potraživanja iz specifičnih poslova", accountRanges: [["21", "229"]], sign: "debit", indent: 1 },
  { aop: 36, label: "VI. Kratkoročni finansijski plasmani", accountRanges: [["23", "239"]], sign: "debit", indent: 1 },
  { aop: 37, label: "VII. Gotovinski ekvivalenti i gotovina", accountRanges: [["24", "249"]], sign: "debit", indent: 1 },
  { aop: 38, label: "VIII. PDV i AVR", accountRanges: [["27", "289"]], sign: "debit", indent: 1 },

  // ── V. ODLOŽENA PORESKA SREDSTVA ──
  { aop: 39, label: "V. ODLOŽENA PORESKA SREDSTVA", accountRanges: [["498", "498"]], sign: "debit", bold: true, indent: 0 },

  // ── G. POSLOVNA IMOVINA ──
  { aop: 40, label: "G. POSLOVNA IMOVINA (2+27+39)", formula: { plus: [2, 27, 39] }, sign: "debit", bold: true },

  // ── D. GUBITAK IZNAD VISINE KAPITALA ──
  { aop: 44, label: "D. GUBITAK IZNAD VISINE KAPITALA", accountRanges: [["29", "299"]], sign: "debit", bold: true },

  // ── Đ. UKUPNA AKTIVA ──
  { aop: 45, label: "Đ. UKUPNA AKTIVA (40+44)", formula: { plus: [40, 44] }, sign: "debit", bold: true, separator: true },

  // ═══════════════════════════════════════════
  // PASIVA
  // ═══════════════════════════════════════════
  { aop: 101, label: "PASIVA", formula: { plus: [102, 119, 129, 140] }, sign: "credit", bold: true, sectionHeader: true, separator: true },

  // ── A. KAPITAL ──
  { aop: 102, label: "A. KAPITAL (103+104+105+106+107-108-109)", formula: { plus: [103, 104, 105, 106, 107], minus: [108, 109] }, sign: "credit", bold: true, sectionHeader: true },
  { aop: 103, label: "I. Osnovni kapital", accountRanges: [["30", "309"]], sign: "credit", indent: 1 },
  { aop: 104, label: "II. Upisani a neuplaćeni kapital", accountRanges: [["31", "319"]], sign: "debit", indent: 1 },
  { aop: 105, label: "III. Rezerve", accountRanges: [["32", "329"]], sign: "credit", indent: 1 },
  { aop: 106, label: "IV. Revalorizacione rezerve", accountRanges: [["33", "339"]], sign: "credit", indent: 1 },
  { aop: 107, label: "V. Neraspoređeni dobitak", accountRanges: [["34", "349"]], sign: "credit", indent: 1 },
  { aop: 108, label: "VI. Gubitak", accountRanges: [["35", "359"]], sign: "debit", indent: 1 },
  { aop: 109, label: "VII. Otkupljene sopstvene akcije", accountRanges: [["037", "037"]], sign: "debit", indent: 1 },

  // ── B. DUGOROČNA REZERVISANJA I OBAVEZE ──
  { aop: 119, label: "B. DUGOROČNA REZERVISANJA I OBAVEZE (120+121)", formula: { plus: [120, 121] }, sign: "credit", bold: true, sectionHeader: true },
  { aop: 120, label: "I. Dugoročna rezervisanja", accountRanges: [["40", "409"]], sign: "credit", indent: 1 },
  { aop: 121, label: "II. Dugoročne obaveze (122+123+124)", formula: { plus: [122, 123, 124] }, sign: "credit", bold: true, indent: 1 },
  { aop: 122, label: "1. Dugoročni krediti", accountRanges: [["410", "414"]], sign: "credit", indent: 2 },
  { aop: 123, label: "2. Ostale dugoročne obaveze", accountRanges: [["415", "419"]], sign: "credit", indent: 2 },
  { aop: 124, label: "3. Dugoročne obaveze - matično preduzeće", accountRanges: [["419", "419"]], sign: "credit", indent: 2 },

  // ── V. KRATKOROČNE OBAVEZE ──
  { aop: 129, label: "V. KRATKOROČNE OBAVEZE (130+131+132+133+134+135)", formula: { plus: [130, 131, 132, 133, 134, 135] }, sign: "credit", bold: true, sectionHeader: true },
  { aop: 130, label: "I. Kratkoročne finansijske obaveze", accountRanges: [["42", "429"]], sign: "credit", indent: 1 },
  { aop: 131, label: "II. Obaveze iz poslovanja", accountRanges: [["43", "439"]], sign: "credit", indent: 1 },
  { aop: 132, label: "III. Ostale kratkoročne obaveze", accountRanges: [["44", "449"], ["45", "459"], ["46", "469"]], sign: "credit", indent: 1 },
  { aop: 133, label: "IV. Obaveze po osnovu PDV-a i ostalih javnih prihoda", accountRanges: [["47", "479"]], sign: "credit", indent: 1 },
  { aop: 134, label: "V. Obaveze po osnovu poreza na dobitak", accountRanges: [["490", "497"]], sign: "credit", indent: 1 },
  { aop: 135, label: "VI. Pasivna vremenska razgraničenja", accountRanges: [["48", "489"]], sign: "credit", indent: 1 },

  // ── G. ODLOŽENE PORESKE OBAVEZE ──
  { aop: 140, label: "G. ODLOŽENE PORESKE OBAVEZE", accountRanges: [["499", "499"]], sign: "credit", bold: true },

  // ── D. UKUPNA PASIVA ──
  { aop: 141, label: "D. UKUPNA PASIVA (102+119+129+140)", formula: { plus: [102, 119, 129, 140] }, sign: "credit", bold: true, separator: true },
];
