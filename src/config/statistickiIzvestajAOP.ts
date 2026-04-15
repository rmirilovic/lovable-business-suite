/**
 * Statistički izveštaj – AOP pozicije prema Pravilniku o sadržini i formi obrazaca
 * finansijskih izveštaja za privredna društva (RS).
 *
 * Pozicije pokrivaju:
 *  I. Opšti podaci (zaglavlje)
 *  II. Bruto promene nematerijalne imovine, nekret., postrojenja, opreme i bioloških sredstava
 *  III. Struktura zaliha
 *  IV. Troškovi zarada i naknade zarada
 *  V. Ostali podaci
 */

export interface StatAopPosition {
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

export const statistickiIzvestajPositions: StatAopPosition[] = [
  // ═══════════════════════════════════════════
  // II. BRUTO PROMENE NEMATERIJALNIH ULAGANJA, NEKRETNINA, POSTROJENJA, OPREME I BIOLOŠKIH SREDSTAVA
  // ═══════════════════════════════════════════
  { aop: 8001, label: "I. NEMATERIJALNA IMOVINA", formula: { plus: [8002, 8003, 8004, 8005] }, sign: "debit", bold: true, sectionHeader: true, separator: true },
  { aop: 8002, label: "1. Goodwill", accountRanges: [["012", "012"]], sign: "debit", indent: 1 },
  { aop: 8003, label: "2. Koncesije, patenti, licence", accountRanges: [["011", "011"]], sign: "debit", indent: 1 },
  { aop: 8004, label: "3. Ostala nematerijalna imovina", accountRanges: [["013", "014"]], sign: "debit", indent: 1 },
  { aop: 8005, label: "4. Nematerijalna imovina u pripremi i avansi", accountRanges: [["015", "019"]], sign: "debit", indent: 1 },

  { aop: 8010, label: "II. NEKRETNINE, POSTROJENJA I OPREMA", formula: { plus: [8011, 8012, 8013, 8014, 8015] }, sign: "debit", bold: true, sectionHeader: true, separator: true },
  { aop: 8011, label: "1. Zemljišta", accountRanges: [["020", "020"]], sign: "debit", indent: 1 },
  { aop: 8012, label: "2. Građevinski objekti", accountRanges: [["021", "022"]], sign: "debit", indent: 1 },
  { aop: 8013, label: "3. Postrojenja i oprema", accountRanges: [["023", "024"]], sign: "debit", indent: 1 },
  { aop: 8014, label: "4. Nekret., postrojenja i oprema u pripremi", accountRanges: [["025", "026"]], sign: "debit", indent: 1 },
  { aop: 8015, label: "5. Avansi za nekret., postrojenja i opremu", accountRanges: [["027", "029"]], sign: "debit", indent: 1 },

  { aop: 8020, label: "III. BIOLOŠKA SREDSTVA", formula: { plus: [8021, 8022, 8023] }, sign: "debit", bold: true, sectionHeader: true, separator: true },
  { aop: 8021, label: "1. Šume i višegodišnji zasadi", accountRanges: [["030", "031"]], sign: "debit", indent: 1 },
  { aop: 8022, label: "2. Osnovno stado", accountRanges: [["032", "033"]], sign: "debit", indent: 1 },
  { aop: 8023, label: "3. Biološka sredstva u pripremi i avansi", accountRanges: [["034", "039"]], sign: "debit", indent: 1 },

  // ═══════════════════════════════════════════
  // III. STRUKTURA ZALIHA
  // ═══════════════════════════════════════════
  { aop: 8030, label: "IV. ZALIHE", formula: { plus: [8031, 8032, 8033, 8034, 8035] }, sign: "debit", bold: true, sectionHeader: true, separator: true },
  { aop: 8031, label: "1. Materijal, rezervni delovi, alat i sitan inventar", accountRanges: [["10", "109"]], sign: "debit", indent: 1 },
  { aop: 8032, label: "2. Nedovršena proizvodnja i nedovršene usluge", accountRanges: [["11", "119"]], sign: "debit", indent: 1 },
  { aop: 8033, label: "3. Gotovi proizvodi", accountRanges: [["12", "129"]], sign: "debit", indent: 1 },
  { aop: 8034, label: "4. Roba", accountRanges: [["13", "139"]], sign: "debit", indent: 1 },
  { aop: 8035, label: "5. Dati avansi", accountRanges: [["15", "159"]], sign: "debit", indent: 1 },

  // ═══════════════════════════════════════════
  // IV. TROŠKOVI ZARADA I NAKNADE ZARADA
  // ═══════════════════════════════════════════
  { aop: 8040, label: "V. TROŠKOVI ZARADA I NAKNADE ZARADA", formula: { plus: [8041, 8042, 8043, 8044] }, sign: "debit", bold: true, sectionHeader: true, separator: true },
  { aop: 8041, label: "1. Troškovi zarada (bruto)", accountRanges: [["520", "522"]], sign: "debit", indent: 1 },
  { aop: 8042, label: "2. Troškovi naknada zarada (bruto)", accountRanges: [["523", "524"]], sign: "debit", indent: 1 },
  { aop: 8043, label: "3. Troškovi ostalih ličnih primanja", accountRanges: [["525", "526"]], sign: "debit", indent: 1 },
  { aop: 8044, label: "4. Troškovi naknada članovima UO i NO", accountRanges: [["527", "529"]], sign: "debit", indent: 1 },

  // ═══════════════════════════════════════════
  // V. OSTALI PODACI
  // ═══════════════════════════════════════════
  { aop: 8050, label: "VI. AMORTIZACIJA", formula: { plus: [8051, 8052, 8053] }, sign: "debit", bold: true, sectionHeader: true, separator: true },
  { aop: 8051, label: "1. Amortizacija nematerijalne imovine", accountRanges: [["540", "540"]], sign: "debit", indent: 1 },
  { aop: 8052, label: "2. Amortizacija nekretnina, postrojenja i opreme", accountRanges: [["541", "541"]], sign: "debit", indent: 1 },
  { aop: 8053, label: "3. Amortizacija bioloških sredstava", accountRanges: [["542", "542"]], sign: "debit", indent: 1 },

  { aop: 8060, label: "VII. DUGOROČNI FINANSIJSKI PLASMANI", formula: { plus: [8061, 8062, 8063] }, sign: "debit", bold: true, sectionHeader: true, separator: true },
  { aop: 8061, label: "1. Učešća u kapitalu", accountRanges: [["040", "042"]], sign: "debit", indent: 1 },
  { aop: 8062, label: "2. Ostali dugoročni finansijski plasmani", accountRanges: [["043", "048"]], sign: "debit", indent: 1 },
  { aop: 8063, label: "3. Dugor. fin. plasmani - matično preduzeće", accountRanges: [["049", "049"]], sign: "debit", indent: 1 },

  { aop: 8070, label: "VIII. KRATKOROČNA POTRAŽIVANJA I PLASMANI", formula: { plus: [8071, 8072, 8073, 8074] }, sign: "debit", bold: true, sectionHeader: true, separator: true },
  { aop: 8071, label: "1. Potraživanja po osnovu prodaje", accountRanges: [["20", "209"]], sign: "debit", indent: 1 },
  { aop: 8072, label: "2. Potraživanja iz spec. poslova i druga potr.", accountRanges: [["21", "229"]], sign: "debit", indent: 1 },
  { aop: 8073, label: "3. Kratkoročni finansijski plasmani", accountRanges: [["23", "239"]], sign: "debit", indent: 1 },
  { aop: 8074, label: "4. Gotovinski ekvivalenti i gotovina", accountRanges: [["24", "249"]], sign: "debit", indent: 1 },

  { aop: 8080, label: "IX. OBAVEZE", formula: { plus: [8081, 8082, 8083, 8084, 8085] }, sign: "credit", bold: true, sectionHeader: true, separator: true },
  { aop: 8081, label: "1. Dugoročna rezervisanja", accountRanges: [["40", "409"]], sign: "credit", indent: 1 },
  { aop: 8082, label: "2. Dugoročne obaveze", accountRanges: [["41", "419"]], sign: "credit", indent: 1 },
  { aop: 8083, label: "3. Kratkoročne finansijske obaveze", accountRanges: [["42", "429"]], sign: "credit", indent: 1 },
  { aop: 8084, label: "4. Obaveze iz poslovanja", accountRanges: [["43", "439"]], sign: "credit", indent: 1 },
  { aop: 8085, label: "5. Ostale kratkoročne obaveze", accountRanges: [["44", "489"]], sign: "credit", indent: 1 },

  { aop: 8090, label: "X. PRIHODI I RASHODI", formula: { plus: [8091, 8092] }, sign: "credit", bold: true, sectionHeader: true, separator: true },
  { aop: 8091, label: "1. Ukupni prihodi", accountRanges: [["60", "699"]], sign: "credit", indent: 1 },
  { aop: 8092, label: "2. Ukupni rashodi", accountRanges: [["50", "599"]], sign: "debit", indent: 1 },
  { aop: 8093, label: "3. Rezultat (prihodi - rashodi)", formula: { plus: [8091], minus: [8092] }, sign: "credit", bold: true, indent: 1 },
];
