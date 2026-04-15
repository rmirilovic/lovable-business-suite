/**
 * Bilans uspeha – AOP pozicije prema Pravilniku o sadržini i formi obrazaca
 * finansijskih izveštaja za privredna društva (RS).
 *
 * Svaka pozicija definiše:
 *  - aop: redni broj AOP pozicije
 *  - label: naziv pozicije
 *  - accountRanges: opsezi konta čiji se promet sabira (duguje/potražuje)
 *  - formula: alternativno, računa se iz drugih AOP pozicija
 *  - bold / indent / separator: stilski flagovi
 *  - sign: "credit" (prihod, potražuje-duguje) ili "debit" (rashod, duguje-potražuje)
 */

export interface AopPosition {
  aop: number;
  label: string;
  /** Opsezi konta: svaki element je [od, do] string opseg */
  accountRanges?: [string, string][];
  /** Formula: aop brojevi za sabiranje (+) ili oduzimanje (-) */
  formula?: { plus?: number[]; minus?: number[] };
  sign?: "credit" | "debit";
  bold?: boolean;
  indent?: number;
  separator?: boolean;
  /** Ako je true, prikazuje se kao zaglavlje sekcije */
  sectionHeader?: boolean;
}

export const bilansUspehaPositions: AopPosition[] = [
  // ── I. POSLOVNI PRIHODI ──
  { aop: 1001, label: "I. POSLOVNI PRIHODI (1002 + 1009)", formula: { plus: [1002, 1009] }, sign: "credit", bold: true, sectionHeader: true },
  { aop: 1002, label: "1. Prihodi od prodaje (1003 + 1004 + 1005 + 1006)", formula: { plus: [1003, 1004, 1005, 1006] }, sign: "credit", bold: true, indent: 1 },
  { aop: 1003, label: "a) Prihodi od prodaje robe", accountRanges: [["600", "600"]], sign: "credit", indent: 2 },
  { aop: 1004, label: "b) Prihodi od prodaje proizvoda i usluga", accountRanges: [["601", "605"]], sign: "credit", indent: 2 },
  { aop: 1005, label: "v) Prihodi od premija, subvencija, dotacija...", accountRanges: [["606", "609"]], sign: "credit", indent: 2 },
  { aop: 1006, label: "g) Drugi poslovni prihodi", accountRanges: [["610", "619"]], sign: "credit", indent: 2 },
  { aop: 1009, label: "2. Prihodi od aktiviranja učinaka i robe", accountRanges: [["620", "629"]], sign: "credit", indent: 1 },

  // ── II. POSLOVNI RASHODI ──
  { aop: 1010, label: "II. POSLOVNI RASHODI (1011+1012+1013+1014+1015+1016)", formula: { plus: [1011, 1012, 1013, 1014, 1015, 1016] }, sign: "debit", bold: true, sectionHeader: true },
  { aop: 1011, label: "1. Nabavna vrednost prodate robe", accountRanges: [["500", "501"]], sign: "debit", indent: 1 },
  { aop: 1012, label: "2. Troškovi materijala", accountRanges: [["510", "514"]], sign: "debit", indent: 1 },
  { aop: 1013, label: "3. Troškovi zarada, naknada zarada i ostali lični rashodi", accountRanges: [["520", "529"]], sign: "debit", indent: 1 },
  { aop: 1014, label: "4. Troškovi amortizacije", accountRanges: [["540", "541"]], sign: "debit", indent: 1 },
  { aop: 1015, label: "5. Ostali poslovni rashodi", accountRanges: [["530", "539"], ["549", "559"]], sign: "debit", indent: 1 },
  { aop: 1016, label: "6. Povećanje/smanjenje vrednosti zaliha", accountRanges: [["560", "569"]], sign: "debit", indent: 1 },

  // ── III/IV. POSLOVNI REZULTAT ──
  { aop: 1017, label: "III. POSLOVNI DOBITAK (1001 - 1010)", formula: { plus: [1001], minus: [1010] }, sign: "credit", bold: true, separator: true },
  { aop: 1018, label: "IV. POSLOVNI GUBITAK (1010 - 1001)", formula: { plus: [1010], minus: [1001] }, sign: "debit", bold: true },

  // ── V. FINANSIJSKI PRIHODI ──
  { aop: 1019, label: "V. FINANSIJSKI PRIHODI (1020 + 1021)", formula: { plus: [1020, 1021] }, sign: "credit", bold: true, sectionHeader: true },
  { aop: 1020, label: "1. Finansijski prihodi od povezanih lica", accountRanges: [["660", "661"]], sign: "credit", indent: 1 },
  { aop: 1021, label: "2. Ostali finansijski prihodi", accountRanges: [["662", "669"]], sign: "credit", indent: 1 },

  // ── VI. FINANSIJSKI RASHODI ──
  { aop: 1022, label: "VI. FINANSIJSKI RASHODI (1023 + 1024)", formula: { plus: [1023, 1024] }, sign: "debit", bold: true, sectionHeader: true },
  { aop: 1023, label: "1. Finansijski rashodi iz odnosa sa pov. licima", accountRanges: [["560", "561"]], sign: "debit", indent: 1 },
  { aop: 1024, label: "2. Ostali finansijski rashodi", accountRanges: [["562", "569"]], sign: "debit", indent: 1 },

  // ── VII/VIII. REZULTAT FINANSIRANJA ──
  { aop: 1025, label: "VII. DOBITAK IZ FINANSIRANJA (1019 - 1022)", formula: { plus: [1019], minus: [1022] }, sign: "credit", bold: true },
  { aop: 1026, label: "VIII. GUBITAK IZ FINANSIRANJA (1022 - 1019)", formula: { plus: [1022], minus: [1019] }, sign: "debit", bold: true },

  // ── IX. OSTALI PRIHODI ──
  { aop: 1027, label: "IX. OSTALI PRIHODI", accountRanges: [["680", "699"]], sign: "credit", bold: true, sectionHeader: true },

  // ── X. OSTALI RASHODI ──
  { aop: 1028, label: "X. OSTALI RASHODI", accountRanges: [["580", "599"]], sign: "debit", bold: true, sectionHeader: true },

  // ── XI/XII. DOBITAK/GUBITAK IZ REDOVNOG POSLOVANJA ──
  { aop: 1029, label: "XI. DOBITAK IZ REDOVNOG POSL. PRE OPOREZIVANJA (1017-1018+1025-1026+1027-1028)", formula: { plus: [1017, 1025, 1027], minus: [1018, 1026, 1028] }, sign: "credit", bold: true, separator: true },
  { aop: 1030, label: "XII. GUBITAK IZ REDOVNOG POSL. PRE OPOREZIVANJA (1018-1017+1026-1025+1028-1027)", formula: { plus: [1018, 1026, 1028], minus: [1017, 1025, 1027] }, sign: "debit", bold: true },

  // ── POREZ I NETO REZULTAT ──
  { aop: 1031, label: "XIII. POREZ NA DOBITAK", accountRanges: [["720", "722"]], sign: "debit", bold: true, separator: true },
  { aop: 1032, label: "XIV. ODLOŽENI PORESKI RASHODI PERIODA", accountRanges: [["723", "723"]], sign: "debit", indent: 1 },
  { aop: 1033, label: "XV. ODLOŽENI PORESKI PRIHODI PERIODA", accountRanges: [["724", "724"]], sign: "credit", indent: 1 },

  { aop: 1034, label: "XVI. NETO DOBITAK (1029-1030-1031-1032+1033)", formula: { plus: [1029, 1033], minus: [1030, 1031, 1032] }, sign: "credit", bold: true, separator: true },
  { aop: 1035, label: "XVII. NETO GUBITAK (1030-1029+1031+1032-1033)", formula: { plus: [1030, 1031, 1032], minus: [1029, 1033] }, sign: "debit", bold: true },
];
