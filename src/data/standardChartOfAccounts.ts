import { AccountType } from "@/hooks/useChartOfAccounts";

interface StandardAccount {
  code: string;
  name: string;
  account_type: AccountType;
  parent_code: string | null;
  level: number;
  is_posting_allowed: boolean;
}

// Standardni kontni okvir za privredna društva Republike Srbije
// Prema Pravilniku o Kontnom okviru i sadržini računa u Kontnom okviru za privredna društva, zadruge i preduzetnike

export const STANDARD_CHART_OF_ACCOUNTS: StandardAccount[] = [
  // ============================================
  // KLASA 0 - NEUPLAĆENI UPISANI KAPITAL I STALNA IMOVINA
  // ============================================
  { code: "0", name: "NEUPLAĆENI UPISANI KAPITAL I STALNA IMOVINA", account_type: "asset", parent_code: null, level: 1, is_posting_allowed: false },
  
  // Grupa 00 - Neuplaćeni upisani kapital
  { code: "00", name: "Neuplaćeni upisani kapital", account_type: "asset", parent_code: "0", level: 2, is_posting_allowed: false },
  { code: "000", name: "Neuplaćeni upisani kapital - akcije", account_type: "asset", parent_code: "00", level: 3, is_posting_allowed: true },
  { code: "001", name: "Neuplaćeni upisani kapital - udeli", account_type: "asset", parent_code: "00", level: 3, is_posting_allowed: true },
  
  // Grupa 01 - Goodwill
  { code: "01", name: "Goodwill", account_type: "asset", parent_code: "0", level: 2, is_posting_allowed: false },
  { code: "010", name: "Goodwill", account_type: "asset", parent_code: "01", level: 3, is_posting_allowed: true },
  { code: "011", name: "Negativni goodwill", account_type: "asset", parent_code: "01", level: 3, is_posting_allowed: true },
  { code: "019", name: "Ispravka vrednosti goodwill-a", account_type: "asset", parent_code: "01", level: 3, is_posting_allowed: true },
  
  // Grupa 02 - Nematerijalna imovina
  { code: "02", name: "Nematerijalna imovina", account_type: "asset", parent_code: "0", level: 2, is_posting_allowed: false },
  { code: "020", name: "Ulaganja u razvoj", account_type: "asset", parent_code: "02", level: 3, is_posting_allowed: true },
  { code: "021", name: "Koncesije, patenti, licence i slična prava", account_type: "asset", parent_code: "02", level: 3, is_posting_allowed: true },
  { code: "022", name: "Ostala nematerijalna imovina", account_type: "asset", parent_code: "02", level: 3, is_posting_allowed: true },
  { code: "023", name: "Nematerijalna imovina u pripremi", account_type: "asset", parent_code: "02", level: 3, is_posting_allowed: true },
  { code: "024", name: "Avansi za nematerijalnu imovinu", account_type: "asset", parent_code: "02", level: 3, is_posting_allowed: true },
  { code: "029", name: "Ispravka vrednosti nematerijalne imovine", account_type: "asset", parent_code: "02", level: 3, is_posting_allowed: true },
  
  // Grupa 03 - Nekretnine, postrojenja i oprema
  { code: "03", name: "Nekretnine, postrojenja i oprema", account_type: "asset", parent_code: "0", level: 2, is_posting_allowed: false },
  { code: "030", name: "Zemljišta", account_type: "asset", parent_code: "03", level: 3, is_posting_allowed: true },
  { code: "031", name: "Građevinski objekti", account_type: "asset", parent_code: "03", level: 3, is_posting_allowed: true },
  { code: "032", name: "Postrojenja i oprema", account_type: "asset", parent_code: "03", level: 3, is_posting_allowed: true },
  { code: "033", name: "Investicione nekretnine", account_type: "asset", parent_code: "03", level: 3, is_posting_allowed: true },
  { code: "034", name: "Ostale nekretnine, postrojenja i oprema", account_type: "asset", parent_code: "03", level: 3, is_posting_allowed: true },
  { code: "035", name: "Nekretnine, postrojenja i oprema u pripremi", account_type: "asset", parent_code: "03", level: 3, is_posting_allowed: true },
  { code: "036", name: "Ulaganja na tuđim nekretninama", account_type: "asset", parent_code: "03", level: 3, is_posting_allowed: true },
  { code: "037", name: "Avansi za nekretnine, postrojenja i opremu", account_type: "asset", parent_code: "03", level: 3, is_posting_allowed: true },
  { code: "039", name: "Ispravka vrednosti nekretnina, postrojenja i opreme", account_type: "asset", parent_code: "03", level: 3, is_posting_allowed: true },
  
  // Grupa 04 - Biološka sredstva
  { code: "04", name: "Biološka sredstva", account_type: "asset", parent_code: "0", level: 2, is_posting_allowed: false },
  { code: "040", name: "Šume", account_type: "asset", parent_code: "04", level: 3, is_posting_allowed: true },
  { code: "041", name: "Višegodišnji zasadi", account_type: "asset", parent_code: "04", level: 3, is_posting_allowed: true },
  { code: "042", name: "Osnovno stado", account_type: "asset", parent_code: "04", level: 3, is_posting_allowed: true },
  { code: "043", name: "Ostala biološka sredstva", account_type: "asset", parent_code: "04", level: 3, is_posting_allowed: true },
  { code: "044", name: "Biološka sredstva u pripremi", account_type: "asset", parent_code: "04", level: 3, is_posting_allowed: true },
  { code: "049", name: "Ispravka vrednosti bioloških sredstava", account_type: "asset", parent_code: "04", level: 3, is_posting_allowed: true },
  
  // Grupa 05 - Dugoročni finansijski plasmani
  { code: "05", name: "Dugoročni finansijski plasmani", account_type: "asset", parent_code: "0", level: 2, is_posting_allowed: false },
  { code: "050", name: "Učešća u kapitalu zavisnih pravnih lica", account_type: "asset", parent_code: "05", level: 3, is_posting_allowed: true },
  { code: "051", name: "Učešća u kapitalu pridruženih pravnih lica", account_type: "asset", parent_code: "05", level: 3, is_posting_allowed: true },
  { code: "052", name: "Učešća u kapitalu ostalih pravnih lica", account_type: "asset", parent_code: "05", level: 3, is_posting_allowed: true },
  { code: "053", name: "Dugoročni krediti matičnim, zavisnim i ostalim povezanim pravnim licima", account_type: "asset", parent_code: "05", level: 3, is_posting_allowed: true },
  { code: "054", name: "Dugoročni krediti u zemlji", account_type: "asset", parent_code: "05", level: 3, is_posting_allowed: true },
  { code: "055", name: "Dugoročni krediti u inostranstvu", account_type: "asset", parent_code: "05", level: 3, is_posting_allowed: true },
  { code: "056", name: "Hartije od vrednosti koje se drže do dospeća", account_type: "asset", parent_code: "05", level: 3, is_posting_allowed: true },
  { code: "057", name: "Otkupljene sopstvene akcije i otkupljeni sopstveni udeli", account_type: "asset", parent_code: "05", level: 3, is_posting_allowed: true },
  { code: "058", name: "Ostali dugoročni finansijski plasmani", account_type: "asset", parent_code: "05", level: 3, is_posting_allowed: true },
  { code: "059", name: "Ispravka vrednosti dugoročnih finansijskih plasmana", account_type: "asset", parent_code: "05", level: 3, is_posting_allowed: true },
  
  // Grupa 08 - Imovina iz ugovora o lizingu
  { code: "08", name: "Imovina iz ugovora o lizingu", account_type: "asset", parent_code: "0", level: 2, is_posting_allowed: false },
  { code: "080", name: "Imovina iz ugovora o lizingu - nekretnine", account_type: "asset", parent_code: "08", level: 3, is_posting_allowed: true },
  { code: "081", name: "Imovina iz ugovora o lizingu - oprema", account_type: "asset", parent_code: "08", level: 3, is_posting_allowed: true },
  { code: "089", name: "Ispravka vrednosti imovine iz ugovora o lizingu", account_type: "asset", parent_code: "08", level: 3, is_posting_allowed: true },

  // ============================================
  // KLASA 1 - ZALIHE
  // ============================================
  { code: "1", name: "ZALIHE", account_type: "asset", parent_code: null, level: 1, is_posting_allowed: false },
  
  // Grupa 10 - Materijal
  { code: "10", name: "Materijal", account_type: "asset", parent_code: "1", level: 2, is_posting_allowed: false },
  { code: "100", name: "Obračun nabavke materijala", account_type: "asset", parent_code: "10", level: 3, is_posting_allowed: true },
  { code: "101", name: "Materijal na zalihama", account_type: "asset", parent_code: "10", level: 3, is_posting_allowed: true },
  { code: "102", name: "Rezervni delovi", account_type: "asset", parent_code: "10", level: 3, is_posting_allowed: true },
  { code: "103", name: "Alat i inventar", account_type: "asset", parent_code: "10", level: 3, is_posting_allowed: true },
  { code: "104", name: "Ambalaža", account_type: "asset", parent_code: "10", level: 3, is_posting_allowed: true },
  { code: "105", name: "Auto-gume", account_type: "asset", parent_code: "10", level: 3, is_posting_allowed: true },
  { code: "108", name: "Materijal u doradi, obradi i manipulaciji", account_type: "asset", parent_code: "10", level: 3, is_posting_allowed: true },
  { code: "109", name: "Ispravka vrednosti materijala", account_type: "asset", parent_code: "10", level: 3, is_posting_allowed: true },
  
  // Grupa 11 - Nedovršena proizvodnja i usluge
  { code: "11", name: "Nedovršena proizvodnja i usluge", account_type: "asset", parent_code: "1", level: 2, is_posting_allowed: false },
  { code: "110", name: "Nedovršena proizvodnja", account_type: "asset", parent_code: "11", level: 3, is_posting_allowed: true },
  { code: "111", name: "Nedovršene usluge", account_type: "asset", parent_code: "11", level: 3, is_posting_allowed: true },
  { code: "119", name: "Ispravka vrednosti nedovršene proizvodnje i usluga", account_type: "asset", parent_code: "11", level: 3, is_posting_allowed: true },
  
  // Grupa 12 - Gotovi proizvodi
  { code: "12", name: "Gotovi proizvodi", account_type: "asset", parent_code: "1", level: 2, is_posting_allowed: false },
  { code: "120", name: "Gotovi proizvodi na zalihama", account_type: "asset", parent_code: "12", level: 3, is_posting_allowed: true },
  { code: "121", name: "Gotovi proizvodi u sopstvenim prodavnicama", account_type: "asset", parent_code: "12", level: 3, is_posting_allowed: true },
  { code: "122", name: "Gotovi proizvodi u consignment skladištima", account_type: "asset", parent_code: "12", level: 3, is_posting_allowed: true },
  { code: "129", name: "Ispravka vrednosti gotovih proizvoda", account_type: "asset", parent_code: "12", level: 3, is_posting_allowed: true },
  
  // Grupa 13 - Roba
  { code: "13", name: "Roba", account_type: "asset", parent_code: "1", level: 2, is_posting_allowed: false },
  { code: "130", name: "Obračun nabavke robe", account_type: "asset", parent_code: "13", level: 3, is_posting_allowed: true },
  { code: "131", name: "Roba u magacinu", account_type: "asset", parent_code: "13", level: 3, is_posting_allowed: true },
  { code: "132", name: "Roba u prodavnici", account_type: "asset", parent_code: "13", level: 3, is_posting_allowed: true },
  { code: "133", name: "Roba u tranzitu", account_type: "asset", parent_code: "13", level: 3, is_posting_allowed: true },
  { code: "134", name: "Roba u consignment skladištima", account_type: "asset", parent_code: "13", level: 3, is_posting_allowed: true },
  { code: "135", name: "Roba na putu", account_type: "asset", parent_code: "13", level: 3, is_posting_allowed: true },
  { code: "136", name: "Roba u obradi, doradi i manipulaciji", account_type: "asset", parent_code: "13", level: 3, is_posting_allowed: true },
  { code: "139", name: "Ispravka vrednosti robe", account_type: "asset", parent_code: "13", level: 3, is_posting_allowed: true },
  
  // Grupa 14 - Stalna sredstva namenjena prodaji
  { code: "14", name: "Stalna sredstva namenjena prodaji i sredstva poslovanja koje se obustavlja", account_type: "asset", parent_code: "1", level: 2, is_posting_allowed: false },
  { code: "140", name: "Stalna sredstva namenjena prodaji", account_type: "asset", parent_code: "14", level: 3, is_posting_allowed: true },
  { code: "141", name: "Sredstva poslovanja koje se obustavlja", account_type: "asset", parent_code: "14", level: 3, is_posting_allowed: true },
  { code: "149", name: "Ispravka vrednosti stalnih sredstava namenjenih prodaji", account_type: "asset", parent_code: "14", level: 3, is_posting_allowed: true },
  
  // Grupa 15 - Dati avansi za zalihe i usluge
  { code: "15", name: "Dati avansi za zalihe i usluge", account_type: "asset", parent_code: "1", level: 2, is_posting_allowed: false },
  { code: "150", name: "Dati avansi za materijal i robu", account_type: "asset", parent_code: "15", level: 3, is_posting_allowed: true },
  { code: "151", name: "Dati avansi za usluge", account_type: "asset", parent_code: "15", level: 3, is_posting_allowed: true },
  { code: "159", name: "Ispravka vrednosti datih avansa", account_type: "asset", parent_code: "15", level: 3, is_posting_allowed: true },

  // ============================================
  // KLASA 2 - KRATKOROČNA POTRAŽIVANJA, PLASMANI I GOTOVINA
  // ============================================
  { code: "2", name: "KRATKOROČNA POTRAŽIVANJA, PLASMANI I GOTOVINA", account_type: "asset", parent_code: null, level: 1, is_posting_allowed: false },
  
  // Grupa 20 - Potraživanja od prodaje
  { code: "20", name: "Potraživanja od prodaje", account_type: "asset", parent_code: "2", level: 2, is_posting_allowed: false },
  { code: "200", name: "Potraživanja od kupaca - matična i zavisna pravna lica", account_type: "asset", parent_code: "20", level: 3, is_posting_allowed: true },
  { code: "201", name: "Potraživanja od kupaca u zemlji", account_type: "asset", parent_code: "20", level: 3, is_posting_allowed: true },
  { code: "202", name: "Potraživanja od kupaca u inostranstvu", account_type: "asset", parent_code: "20", level: 3, is_posting_allowed: true },
  { code: "203", name: "Potraživanja iz specifičnih poslova", account_type: "asset", parent_code: "20", level: 3, is_posting_allowed: true },
  { code: "204", name: "Potraživanja za nefakturisani prihod", account_type: "asset", parent_code: "20", level: 3, is_posting_allowed: true },
  { code: "209", name: "Ispravka vrednosti potraživanja od prodaje", account_type: "asset", parent_code: "20", level: 3, is_posting_allowed: true },
  
  // Grupa 21 - Potraživanja iz specifičnih poslova
  { code: "21", name: "Potraživanja iz specifičnih poslova", account_type: "asset", parent_code: "2", level: 2, is_posting_allowed: false },
  { code: "210", name: "Potraživanja iz komisione i konsignacione prodaje", account_type: "asset", parent_code: "21", level: 3, is_posting_allowed: true },
  { code: "211", name: "Potraživanja po osnovu prodaje na kredit", account_type: "asset", parent_code: "21", level: 3, is_posting_allowed: true },
  { code: "212", name: "Potraživanja po osnovu izvoza za tuđ račun", account_type: "asset", parent_code: "21", level: 3, is_posting_allowed: true },
  { code: "219", name: "Ispravka vrednosti potraživanja iz specifičnih poslova", account_type: "asset", parent_code: "21", level: 3, is_posting_allowed: true },
  
  // Grupa 22 - Druga potraživanja
  { code: "22", name: "Druga potraživanja", account_type: "asset", parent_code: "2", level: 2, is_posting_allowed: false },
  { code: "220", name: "Potraživanja od zaposlenih", account_type: "asset", parent_code: "22", level: 3, is_posting_allowed: true },
  { code: "221", name: "Potraživanja od državnih organa i organizacija", account_type: "asset", parent_code: "22", level: 3, is_posting_allowed: true },
  { code: "222", name: "Potraživanja po osnovu preplaćenih ostalih poreza i doprinosa", account_type: "asset", parent_code: "22", level: 3, is_posting_allowed: true },
  { code: "223", name: "Potraživanja za više plaćen porez na dobitak", account_type: "asset", parent_code: "22", level: 3, is_posting_allowed: true },
  { code: "224", name: "Potraživanja za dividende i učešće u dobitku", account_type: "asset", parent_code: "22", level: 3, is_posting_allowed: true },
  { code: "225", name: "Potraživanja po osnovu naknada šteta od osiguravajućih društava", account_type: "asset", parent_code: "22", level: 3, is_posting_allowed: true },
  { code: "226", name: "Ostala kratkoročna potraživanja", account_type: "asset", parent_code: "22", level: 3, is_posting_allowed: true },
  { code: "229", name: "Ispravka vrednosti drugih potraživanja", account_type: "asset", parent_code: "22", level: 3, is_posting_allowed: true },
  
  // Grupa 23 - Kratkoročni finansijski plasmani
  { code: "23", name: "Kratkoročni finansijski plasmani", account_type: "asset", parent_code: "2", level: 2, is_posting_allowed: false },
  { code: "230", name: "Kratkoročni krediti - matična i zavisna pravna lica", account_type: "asset", parent_code: "23", level: 3, is_posting_allowed: true },
  { code: "231", name: "Kratkoročni krediti u zemlji", account_type: "asset", parent_code: "23", level: 3, is_posting_allowed: true },
  { code: "232", name: "Kratkoročni krediti u inostranstvu", account_type: "asset", parent_code: "23", level: 3, is_posting_allowed: true },
  { code: "233", name: "Hartije od vrednosti - kratkoročne", account_type: "asset", parent_code: "23", level: 3, is_posting_allowed: true },
  { code: "234", name: "Ostali kratkoročni finansijski plasmani", account_type: "asset", parent_code: "23", level: 3, is_posting_allowed: true },
  { code: "235", name: "Otkupljene sopstvene akcije namenjene prodaji ili poništenju", account_type: "asset", parent_code: "23", level: 3, is_posting_allowed: true },
  { code: "239", name: "Ispravka vrednosti kratkoročnih finansijskih plasmana", account_type: "asset", parent_code: "23", level: 3, is_posting_allowed: true },
  
  // Grupa 24 - Gotovinski ekvivalenti i gotovina
  { code: "24", name: "Gotovinski ekvivalenti i gotovina", account_type: "asset", parent_code: "2", level: 2, is_posting_allowed: false },
  { code: "240", name: "Hartije od vrednosti - gotovinski ekvivalenti", account_type: "asset", parent_code: "24", level: 3, is_posting_allowed: true },
  { code: "241", name: "Tekući (poslovni) računi", account_type: "asset", parent_code: "24", level: 3, is_posting_allowed: true },
  { code: "242", name: "Devizni račun", account_type: "asset", parent_code: "24", level: 3, is_posting_allowed: true },
  { code: "243", name: "Blagajna", account_type: "asset", parent_code: "24", level: 3, is_posting_allowed: true },
  { code: "244", name: "Devizna blagajna", account_type: "asset", parent_code: "24", level: 3, is_posting_allowed: true },
  { code: "245", name: "Ostala novčana sredstva", account_type: "asset", parent_code: "24", level: 3, is_posting_allowed: true },
  { code: "246", name: "Novčana sredstva čije je korišćenje ograničeno", account_type: "asset", parent_code: "24", level: 3, is_posting_allowed: true },
  { code: "249", name: "Ispravka vrednosti gotovinskih ekvivalenata i gotovine", account_type: "asset", parent_code: "24", level: 3, is_posting_allowed: true },
  
  // Grupa 27 - PDV
  { code: "27", name: "Porez na dodatu vrednost", account_type: "asset", parent_code: "2", level: 2, is_posting_allowed: false },
  { code: "270", name: "Porez na dodatu vrednost u primljenim fakturama po opštoj stopi", account_type: "asset", parent_code: "27", level: 3, is_posting_allowed: true },
  { code: "271", name: "Porez na dodatu vrednost u primljenim fakturama po posebnoj stopi", account_type: "asset", parent_code: "27", level: 3, is_posting_allowed: true },
  { code: "272", name: "Porez na dodatu vrednost plaćen pri uvozu", account_type: "asset", parent_code: "27", level: 3, is_posting_allowed: true },
  { code: "273", name: "Porez na dodatu vrednost obračunat na usluge stranog lica", account_type: "asset", parent_code: "27", level: 3, is_posting_allowed: true },
  { code: "274", name: "Porez na dodatu vrednost u datim avansima", account_type: "asset", parent_code: "27", level: 3, is_posting_allowed: true },
  { code: "279", name: "Razlika PDV-a", account_type: "asset", parent_code: "27", level: 3, is_posting_allowed: true },
  
  // Grupa 28 - Aktivna vremenska razgraničenja
  { code: "28", name: "Aktivna vremenska razgraničenja", account_type: "asset", parent_code: "2", level: 2, is_posting_allowed: false },
  { code: "280", name: "Unapred plaćeni troškovi", account_type: "asset", parent_code: "28", level: 3, is_posting_allowed: true },
  { code: "281", name: "Potraživanja za nefakturisani prihod", account_type: "asset", parent_code: "28", level: 3, is_posting_allowed: true },
  { code: "282", name: "Razgraničeni troškovi po osnovu obaveza", account_type: "asset", parent_code: "28", level: 3, is_posting_allowed: true },
  { code: "288", name: "Odložena poreska sredstva", account_type: "asset", parent_code: "28", level: 3, is_posting_allowed: true },
  { code: "289", name: "Ostala aktivna vremenska razgraničenja", account_type: "asset", parent_code: "28", level: 3, is_posting_allowed: true },
  
  // Grupa 29 - Gubitak iznad visine kapitala
  { code: "29", name: "Gubitak iznad visine kapitala", account_type: "asset", parent_code: "2", level: 2, is_posting_allowed: false },
  { code: "290", name: "Gubitak iznad visine kapitala", account_type: "asset", parent_code: "29", level: 3, is_posting_allowed: true },

  // ============================================
  // KLASA 3 - KAPITAL
  // ============================================
  { code: "3", name: "KAPITAL", account_type: "equity", parent_code: null, level: 1, is_posting_allowed: false },
  
  // Grupa 30 - Osnovni kapital
  { code: "30", name: "Osnovni kapital", account_type: "equity", parent_code: "3", level: 2, is_posting_allowed: false },
  { code: "300", name: "Akcijski kapital", account_type: "equity", parent_code: "30", level: 3, is_posting_allowed: true },
  { code: "301", name: "Udeli društva sa ograničenom odgovornošću", account_type: "equity", parent_code: "30", level: 3, is_posting_allowed: true },
  { code: "302", name: "Ulozi", account_type: "equity", parent_code: "30", level: 3, is_posting_allowed: true },
  { code: "303", name: "Državni kapital", account_type: "equity", parent_code: "30", level: 3, is_posting_allowed: true },
  { code: "304", name: "Društveni kapital", account_type: "equity", parent_code: "30", level: 3, is_posting_allowed: true },
  { code: "305", name: "Ostali osnovni kapital", account_type: "equity", parent_code: "30", level: 3, is_posting_allowed: true },
  
  // Grupa 31 - Upisani a neuplaćeni kapital
  { code: "31", name: "Upisani a neuplaćeni kapital", account_type: "equity", parent_code: "3", level: 2, is_posting_allowed: false },
  { code: "310", name: "Upisane a neuplaćene akcije", account_type: "equity", parent_code: "31", level: 3, is_posting_allowed: true },
  { code: "311", name: "Upisani a neuplaćeni udeli", account_type: "equity", parent_code: "31", level: 3, is_posting_allowed: true },
  
  // Grupa 32 - Emisiona premija i rezerve
  { code: "32", name: "Emisiona premija, rezerve i revalorizacione rezerve", account_type: "equity", parent_code: "3", level: 2, is_posting_allowed: false },
  { code: "320", name: "Emisiona premija", account_type: "equity", parent_code: "32", level: 3, is_posting_allowed: true },
  { code: "321", name: "Zakonske rezerve", account_type: "equity", parent_code: "32", level: 3, is_posting_allowed: true },
  { code: "322", name: "Statutarne i druge rezerve", account_type: "equity", parent_code: "32", level: 3, is_posting_allowed: true },
  { code: "323", name: "Revalorizacione rezerve", account_type: "equity", parent_code: "32", level: 3, is_posting_allowed: true },
  { code: "324", name: "Nerealizovani dobici po osnovu hartija od vrednosti", account_type: "equity", parent_code: "32", level: 3, is_posting_allowed: true },
  { code: "325", name: "Nerealizovani gubici po osnovu hartija od vrednosti", account_type: "equity", parent_code: "32", level: 3, is_posting_allowed: true },
  
  // Grupa 33 - Neraspoređeni dobitak
  { code: "33", name: "Neraspoređeni dobitak", account_type: "equity", parent_code: "3", level: 2, is_posting_allowed: false },
  { code: "330", name: "Neraspoređeni dobitak ranijih godina", account_type: "equity", parent_code: "33", level: 3, is_posting_allowed: true },
  { code: "331", name: "Neraspoređeni dobitak tekuće godine", account_type: "equity", parent_code: "33", level: 3, is_posting_allowed: true },
  
  // Grupa 34 - Gubitak
  { code: "34", name: "Gubitak", account_type: "equity", parent_code: "3", level: 2, is_posting_allowed: false },
  { code: "340", name: "Gubitak ranijih godina", account_type: "equity", parent_code: "34", level: 3, is_posting_allowed: true },
  { code: "341", name: "Gubitak tekuće godine", account_type: "equity", parent_code: "34", level: 3, is_posting_allowed: true },
  
  // Grupa 35 - Otkupljene sopstvene akcije i udeli
  { code: "35", name: "Otkupljene sopstvene akcije i udeli", account_type: "equity", parent_code: "3", level: 2, is_posting_allowed: false },
  { code: "350", name: "Otkupljene sopstvene akcije", account_type: "equity", parent_code: "35", level: 3, is_posting_allowed: true },
  { code: "351", name: "Otkupljeni sopstveni udeli", account_type: "equity", parent_code: "35", level: 3, is_posting_allowed: true },

  // ============================================
  // KLASA 4 - DUGOROČNA REZERVISANJA I OBAVEZE
  // ============================================
  { code: "4", name: "DUGOROČNA REZERVISANJA I OBAVEZE", account_type: "liability", parent_code: null, level: 1, is_posting_allowed: false },
  
  // Grupa 40 - Dugoročna rezervisanja
  { code: "40", name: "Dugoročna rezervisanja", account_type: "liability", parent_code: "4", level: 2, is_posting_allowed: false },
  { code: "400", name: "Rezervisanja za troškove u garantnom roku", account_type: "liability", parent_code: "40", level: 3, is_posting_allowed: true },
  { code: "401", name: "Rezervisanja za troškove obnavljanja prirodnih bogatstava", account_type: "liability", parent_code: "40", level: 3, is_posting_allowed: true },
  { code: "402", name: "Rezervisanja za zadržane kaucije i depozite", account_type: "liability", parent_code: "40", level: 3, is_posting_allowed: true },
  { code: "403", name: "Rezervisanja za troškove restrukturiranja", account_type: "liability", parent_code: "40", level: 3, is_posting_allowed: true },
  { code: "404", name: "Rezervisanja za naknade i beneficije zaposlenih", account_type: "liability", parent_code: "40", level: 3, is_posting_allowed: true },
  { code: "405", name: "Rezervisanja za troškove sudskih sporova", account_type: "liability", parent_code: "40", level: 3, is_posting_allowed: true },
  { code: "409", name: "Ostala dugoročna rezervisanja", account_type: "liability", parent_code: "40", level: 3, is_posting_allowed: true },
  
  // Grupa 41 - Dugoročne obaveze
  { code: "41", name: "Dugoročne obaveze", account_type: "liability", parent_code: "4", level: 2, is_posting_allowed: false },
  { code: "410", name: "Obaveze prema povezanim pravnim licima", account_type: "liability", parent_code: "41", level: 3, is_posting_allowed: true },
  { code: "411", name: "Obaveze po emitovanim hartijama od vrednosti", account_type: "liability", parent_code: "41", level: 3, is_posting_allowed: true },
  { code: "412", name: "Dugoročni krediti u zemlji", account_type: "liability", parent_code: "41", level: 3, is_posting_allowed: true },
  { code: "413", name: "Dugoročni krediti u inostranstvu", account_type: "liability", parent_code: "41", level: 3, is_posting_allowed: true },
  { code: "414", name: "Dugoročne obaveze po osnovu lizinga", account_type: "liability", parent_code: "41", level: 3, is_posting_allowed: true },
  { code: "415", name: "Ostale dugoročne obaveze", account_type: "liability", parent_code: "41", level: 3, is_posting_allowed: true },
  
  // Grupa 42 - Kratkoročne finansijske obaveze
  { code: "42", name: "Kratkoročne finansijske obaveze", account_type: "liability", parent_code: "4", level: 2, is_posting_allowed: false },
  { code: "420", name: "Kratkoročni krediti od povezanih pravnih lica", account_type: "liability", parent_code: "42", level: 3, is_posting_allowed: true },
  { code: "421", name: "Kratkoročni krediti u zemlji", account_type: "liability", parent_code: "42", level: 3, is_posting_allowed: true },
  { code: "422", name: "Kratkoročni krediti u inostranstvu", account_type: "liability", parent_code: "42", level: 3, is_posting_allowed: true },
  { code: "423", name: "Deo dugoročnih kredita koji dospeva do jedne godine", account_type: "liability", parent_code: "42", level: 3, is_posting_allowed: true },
  { code: "424", name: "Deo dugoročnih obaveza po osnovu lizinga koje dospevaju do jedne godine", account_type: "liability", parent_code: "42", level: 3, is_posting_allowed: true },
  { code: "425", name: "Obaveze po kratkoročnim hartijama od vrednosti", account_type: "liability", parent_code: "42", level: 3, is_posting_allowed: true },
  { code: "429", name: "Ostale kratkoročne finansijske obaveze", account_type: "liability", parent_code: "42", level: 3, is_posting_allowed: true },
  
  // Grupa 43 - Obaveze iz poslovanja
  { code: "43", name: "Obaveze iz poslovanja", account_type: "liability", parent_code: "4", level: 2, is_posting_allowed: false },
  { code: "430", name: "Primljeni avansi", account_type: "liability", parent_code: "43", level: 3, is_posting_allowed: true },
  { code: "431", name: "Dobavljači - matična i zavisna pravna lica u zemlji", account_type: "liability", parent_code: "43", level: 3, is_posting_allowed: true },
  { code: "432", name: "Dobavljači u zemlji", account_type: "liability", parent_code: "43", level: 3, is_posting_allowed: true },
  { code: "433", name: "Dobavljači u inostranstvu", account_type: "liability", parent_code: "43", level: 3, is_posting_allowed: true },
  { code: "434", name: "Obaveze za nefakturisane isporuke", account_type: "liability", parent_code: "43", level: 3, is_posting_allowed: true },
  { code: "439", name: "Ostale obaveze iz poslovanja", account_type: "liability", parent_code: "43", level: 3, is_posting_allowed: true },
  
  // Grupa 44 - Obaveze iz specifičnih poslova
  { code: "44", name: "Obaveze iz specifičnih poslova", account_type: "liability", parent_code: "4", level: 2, is_posting_allowed: false },
  { code: "440", name: "Obaveze po osnovu prodaje na kredit", account_type: "liability", parent_code: "44", level: 3, is_posting_allowed: true },
  { code: "441", name: "Obaveze po osnovu komisione i konsignacione prodaje", account_type: "liability", parent_code: "44", level: 3, is_posting_allowed: true },
  { code: "449", name: "Ostale obaveze iz specifičnih poslova", account_type: "liability", parent_code: "44", level: 3, is_posting_allowed: true },
  
  // Grupa 45 - Obaveze po osnovu zarada i naknada zarada
  { code: "45", name: "Obaveze po osnovu zarada i naknada zarada", account_type: "liability", parent_code: "4", level: 2, is_posting_allowed: false },
  { code: "450", name: "Obaveze za neto zarade i naknade zarada", account_type: "liability", parent_code: "45", level: 3, is_posting_allowed: true },
  { code: "451", name: "Obaveze za porez na zarade i naknade zarada na teret zaposlenog", account_type: "liability", parent_code: "45", level: 3, is_posting_allowed: true },
  { code: "452", name: "Obaveze za doprinose na zarade i naknade zarada na teret zaposlenog", account_type: "liability", parent_code: "45", level: 3, is_posting_allowed: true },
  { code: "453", name: "Obaveze za poreze i doprinose na zarade i naknade zarada na teret poslodavca", account_type: "liability", parent_code: "45", level: 3, is_posting_allowed: true },
  { code: "454", name: "Obaveze za neto naknade zarada koje se refundiraju", account_type: "liability", parent_code: "45", level: 3, is_posting_allowed: true },
  { code: "455", name: "Obaveze prema zaposlenom za ostale naknade", account_type: "liability", parent_code: "45", level: 3, is_posting_allowed: true },
  { code: "459", name: "Ostale obaveze za zarade i naknade zarada", account_type: "liability", parent_code: "45", level: 3, is_posting_allowed: true },
  
  // Grupa 46 - Druge obaveze
  { code: "46", name: "Druge obaveze", account_type: "liability", parent_code: "4", level: 2, is_posting_allowed: false },
  { code: "460", name: "Obaveze po osnovu kamata i troškova finansiranja", account_type: "liability", parent_code: "46", level: 3, is_posting_allowed: true },
  { code: "461", name: "Obaveze za dividende", account_type: "liability", parent_code: "46", level: 3, is_posting_allowed: true },
  { code: "462", name: "Obaveze za učešće u dobitku", account_type: "liability", parent_code: "46", level: 3, is_posting_allowed: true },
  { code: "463", name: "Obaveze prema članovima upravnog i nadzornog odbora", account_type: "liability", parent_code: "46", level: 3, is_posting_allowed: true },
  { code: "464", name: "Obaveze prema fizičkim licima za naknade po ugovorima", account_type: "liability", parent_code: "46", level: 3, is_posting_allowed: true },
  { code: "465", name: "Obaveze za zadržane kaucije i depozite", account_type: "liability", parent_code: "46", level: 3, is_posting_allowed: true },
  { code: "469", name: "Ostale obaveze", account_type: "liability", parent_code: "46", level: 3, is_posting_allowed: true },
  
  // Grupa 47 - PDV obaveze
  { code: "47", name: "Obaveze za PDV", account_type: "liability", parent_code: "4", level: 2, is_posting_allowed: false },
  { code: "470", name: "Obaveze za PDV po izdatim fakturama po opštoj stopi", account_type: "liability", parent_code: "47", level: 3, is_posting_allowed: true },
  { code: "471", name: "Obaveze za PDV po izdatim fakturama po posebnoj stopi", account_type: "liability", parent_code: "47", level: 3, is_posting_allowed: true },
  { code: "472", name: "Obaveze za PDV po primljenim avansima", account_type: "liability", parent_code: "47", level: 3, is_posting_allowed: true },
  { code: "479", name: "Obaveze za PDV po osnovu razlike", account_type: "liability", parent_code: "47", level: 3, is_posting_allowed: true },
  
  // Grupa 48 - Obaveze za ostale poreze, doprinose i druge dažbine
  { code: "48", name: "Obaveze za ostale poreze, doprinose i druge dažbine", account_type: "liability", parent_code: "4", level: 2, is_posting_allowed: false },
  { code: "480", name: "Obaveze za akcize", account_type: "liability", parent_code: "48", level: 3, is_posting_allowed: true },
  { code: "481", name: "Obaveze za poreze, carine i druge dažbine iz nabavke", account_type: "liability", parent_code: "48", level: 3, is_posting_allowed: true },
  { code: "482", name: "Obaveze za ostale poreze", account_type: "liability", parent_code: "48", level: 3, is_posting_allowed: true },
  { code: "483", name: "Obaveze za porez na dobit", account_type: "liability", parent_code: "48", level: 3, is_posting_allowed: true },
  { code: "489", name: "Ostale obaveze za poreze, doprinose i druge dažbine", account_type: "liability", parent_code: "48", level: 3, is_posting_allowed: true },
  
  // Grupa 49 - Pasivna vremenska razgraničenja
  { code: "49", name: "Pasivna vremenska razgraničenja", account_type: "liability", parent_code: "4", level: 2, is_posting_allowed: false },
  { code: "490", name: "Unapred naplaćeni prihodi", account_type: "liability", parent_code: "49", level: 3, is_posting_allowed: true },
  { code: "491", name: "Razgraničeni zavisni troškovi nabavke", account_type: "liability", parent_code: "49", level: 3, is_posting_allowed: true },
  { code: "492", name: "Razgraničeni prihodi po osnovu potraživanja", account_type: "liability", parent_code: "49", level: 3, is_posting_allowed: true },
  { code: "493", name: "Razgraničeni prihodi po osnovu potencijalnih obaveza", account_type: "liability", parent_code: "49", level: 3, is_posting_allowed: true },
  { code: "498", name: "Odložene poreske obaveze", account_type: "liability", parent_code: "49", level: 3, is_posting_allowed: true },
  { code: "499", name: "Ostala pasivna vremenska razgraničenja", account_type: "liability", parent_code: "49", level: 3, is_posting_allowed: true },

  // ============================================
  // KLASA 5 - RASHODI
  // ============================================
  { code: "5", name: "RASHODI", account_type: "expense", parent_code: null, level: 1, is_posting_allowed: false },
  
  // Grupa 50 - Nabavna vrednost prodate robe
  { code: "50", name: "Nabavna vrednost prodate robe", account_type: "expense", parent_code: "5", level: 2, is_posting_allowed: false },
  { code: "500", name: "Nabavna vrednost prodate robe", account_type: "expense", parent_code: "50", level: 3, is_posting_allowed: true },
  { code: "501", name: "Nabavna vrednost prodatih nekretnina pribavljenih radi prodaje", account_type: "expense", parent_code: "50", level: 3, is_posting_allowed: true },
  
  // Grupa 51 - Troškovi materijala
  { code: "51", name: "Troškovi materijala", account_type: "expense", parent_code: "5", level: 2, is_posting_allowed: false },
  { code: "510", name: "Troškovi materijala za izradu", account_type: "expense", parent_code: "51", level: 3, is_posting_allowed: true },
  { code: "511", name: "Troškovi ostalog materijala", account_type: "expense", parent_code: "51", level: 3, is_posting_allowed: true },
  { code: "512", name: "Troškovi goriva i energije", account_type: "expense", parent_code: "51", level: 3, is_posting_allowed: true },
  { code: "513", name: "Troškovi rezervnih delova", account_type: "expense", parent_code: "51", level: 3, is_posting_allowed: true },
  { code: "514", name: "Troškovi alata i inventara", account_type: "expense", parent_code: "51", level: 3, is_posting_allowed: true },
  { code: "515", name: "Troškovi kancelarijskog materijala", account_type: "expense", parent_code: "51", level: 3, is_posting_allowed: true },
  
  // Grupa 52 - Troškovi zarada, naknada zarada i ostali lični rashodi
  { code: "52", name: "Troškovi zarada, naknada zarada i ostali lični rashodi", account_type: "expense", parent_code: "5", level: 2, is_posting_allowed: false },
  { code: "520", name: "Troškovi zarada i naknada zarada (bruto)", account_type: "expense", parent_code: "52", level: 3, is_posting_allowed: true },
  { code: "521", name: "Troškovi poreza i doprinosa na zarade i naknade zarada na teret poslodavca", account_type: "expense", parent_code: "52", level: 3, is_posting_allowed: true },
  { code: "522", name: "Troškovi naknada po ugovoru o delu", account_type: "expense", parent_code: "52", level: 3, is_posting_allowed: true },
  { code: "523", name: "Troškovi naknada po autorskim ugovorima", account_type: "expense", parent_code: "52", level: 3, is_posting_allowed: true },
  { code: "524", name: "Troškovi naknada fizičkim licima po osnovu ostalih ugovora", account_type: "expense", parent_code: "52", level: 3, is_posting_allowed: true },
  { code: "525", name: "Troškovi naknada članovima upravnog i nadzornog odbora", account_type: "expense", parent_code: "52", level: 3, is_posting_allowed: true },
  { code: "529", name: "Ostali lični rashodi", account_type: "expense", parent_code: "52", level: 3, is_posting_allowed: true },
  
  // Grupa 53 - Troškovi amortizacije i rezervisanja
  { code: "53", name: "Troškovi amortizacije i rezervisanja", account_type: "expense", parent_code: "5", level: 2, is_posting_allowed: false },
  { code: "530", name: "Troškovi amortizacije", account_type: "expense", parent_code: "53", level: 3, is_posting_allowed: true },
  { code: "531", name: "Troškovi rezervisanja za garantni rok", account_type: "expense", parent_code: "53", level: 3, is_posting_allowed: true },
  { code: "532", name: "Troškovi rezervisanja za obnavljanje prirodnih bogatstava", account_type: "expense", parent_code: "53", level: 3, is_posting_allowed: true },
  { code: "533", name: "Troškovi rezervisanja za restrukturiranje", account_type: "expense", parent_code: "53", level: 3, is_posting_allowed: true },
  { code: "534", name: "Troškovi rezervisanja za naknade i beneficije zaposlenih", account_type: "expense", parent_code: "53", level: 3, is_posting_allowed: true },
  { code: "539", name: "Troškovi ostalih rezervisanja", account_type: "expense", parent_code: "53", level: 3, is_posting_allowed: true },
  
  // Grupa 54 - Ostali poslovni rashodi
  { code: "54", name: "Ostali poslovni rashodi", account_type: "expense", parent_code: "5", level: 2, is_posting_allowed: false },
  { code: "540", name: "Troškovi usluga na izradi učinaka", account_type: "expense", parent_code: "54", level: 3, is_posting_allowed: true },
  { code: "541", name: "Troškovi transportnih usluga", account_type: "expense", parent_code: "54", level: 3, is_posting_allowed: true },
  { code: "542", name: "Troškovi usluga održavanja", account_type: "expense", parent_code: "54", level: 3, is_posting_allowed: true },
  { code: "543", name: "Troškovi zakupnina", account_type: "expense", parent_code: "54", level: 3, is_posting_allowed: true },
  { code: "544", name: "Troškovi sajmova", account_type: "expense", parent_code: "54", level: 3, is_posting_allowed: true },
  { code: "545", name: "Troškovi reklame i propagande", account_type: "expense", parent_code: "54", level: 3, is_posting_allowed: true },
  { code: "546", name: "Troškovi istraživanja", account_type: "expense", parent_code: "54", level: 3, is_posting_allowed: true },
  { code: "547", name: "Troškovi ostalih usluga", account_type: "expense", parent_code: "54", level: 3, is_posting_allowed: true },
  { code: "549", name: "Ostali rashodi poslovanja", account_type: "expense", parent_code: "54", level: 3, is_posting_allowed: true },
  
  // Grupa 55 - Finansijski rashodi
  { code: "55", name: "Finansijski rashodi", account_type: "expense", parent_code: "5", level: 2, is_posting_allowed: false },
  { code: "550", name: "Finansijski rashodi iz odnosa sa povezanim pravnim licima", account_type: "expense", parent_code: "55", level: 3, is_posting_allowed: true },
  { code: "551", name: "Rashodi kamata", account_type: "expense", parent_code: "55", level: 3, is_posting_allowed: true },
  { code: "552", name: "Negativne kursne razlike", account_type: "expense", parent_code: "55", level: 3, is_posting_allowed: true },
  { code: "553", name: "Rashodi po osnovu efekata ugovorene valutne klauzule", account_type: "expense", parent_code: "55", level: 3, is_posting_allowed: true },
  { code: "559", name: "Ostali finansijski rashodi", account_type: "expense", parent_code: "55", level: 3, is_posting_allowed: true },
  
  // Grupa 56 - Ostali rashodi
  { code: "56", name: "Ostali rashodi", account_type: "expense", parent_code: "5", level: 2, is_posting_allowed: false },
  { code: "560", name: "Gubici od prodaje nematerijalnih ulaganja, nekretnina, postrojenja i opreme", account_type: "expense", parent_code: "56", level: 3, is_posting_allowed: true },
  { code: "561", name: "Gubici od prodaje učešća u kapitalu i hartija od vrednosti", account_type: "expense", parent_code: "56", level: 3, is_posting_allowed: true },
  { code: "562", name: "Gubici od prodaje materijala", account_type: "expense", parent_code: "56", level: 3, is_posting_allowed: true },
  { code: "563", name: "Manjkovi", account_type: "expense", parent_code: "56", level: 3, is_posting_allowed: true },
  { code: "564", name: "Rashodi po osnovu direktnih otpisa potraživanja", account_type: "expense", parent_code: "56", level: 3, is_posting_allowed: true },
  { code: "565", name: "Rashodi po osnovu rashodovanja i uništenja imovine", account_type: "expense", parent_code: "56", level: 3, is_posting_allowed: true },
  { code: "566", name: "Obezvređenje imovine", account_type: "expense", parent_code: "56", level: 3, is_posting_allowed: true },
  { code: "569", name: "Ostali nepomenuti rashodi", account_type: "expense", parent_code: "56", level: 3, is_posting_allowed: true },
  
  // Grupa 57 - Rashodi po osnovu usklađivanja vrednosti imovine
  { code: "57", name: "Rashodi po osnovu usklađivanja vrednosti imovine", account_type: "expense", parent_code: "5", level: 2, is_posting_allowed: false },
  { code: "570", name: "Obezvređenje bioloških sredstava", account_type: "expense", parent_code: "57", level: 3, is_posting_allowed: true },
  { code: "571", name: "Obezvređenje goodwill-a", account_type: "expense", parent_code: "57", level: 3, is_posting_allowed: true },
  { code: "572", name: "Obezvređenje nematerijalne imovine", account_type: "expense", parent_code: "57", level: 3, is_posting_allowed: true },
  { code: "573", name: "Obezvređenje nekretnina, postrojenja i opreme", account_type: "expense", parent_code: "57", level: 3, is_posting_allowed: true },
  { code: "574", name: "Obezvređenje dugoročnih finansijskih plasmana", account_type: "expense", parent_code: "57", level: 3, is_posting_allowed: true },
  { code: "575", name: "Obezvređenje zaliha", account_type: "expense", parent_code: "57", level: 3, is_posting_allowed: true },
  { code: "576", name: "Obezvređenje potraživanja i kratkoročnih finansijskih plasmana", account_type: "expense", parent_code: "57", level: 3, is_posting_allowed: true },
  { code: "579", name: "Obezvređenje ostale imovine", account_type: "expense", parent_code: "57", level: 3, is_posting_allowed: true },
  
  // Grupa 58 - Rashodi po osnovu promene vrednosti bioloških sredstava
  { code: "58", name: "Rashodi po osnovu promene vrednosti bioloških sredstava", account_type: "expense", parent_code: "5", level: 2, is_posting_allowed: false },
  { code: "580", name: "Rashodi od usklađivanja vrednosti zaliha bioloških sredstava", account_type: "expense", parent_code: "58", level: 3, is_posting_allowed: true },
  
  // Grupa 59 - Porez na dobitak
  { code: "59", name: "Porez na dobitak", account_type: "expense", parent_code: "5", level: 2, is_posting_allowed: false },
  { code: "590", name: "Porez na dobitak", account_type: "expense", parent_code: "59", level: 3, is_posting_allowed: true },
  { code: "591", name: "Odloženi poreski rashodi perioda", account_type: "expense", parent_code: "59", level: 3, is_posting_allowed: true },

  // ============================================
  // KLASA 6 - PRIHODI
  // ============================================
  { code: "6", name: "PRIHODI", account_type: "revenue", parent_code: null, level: 1, is_posting_allowed: false },
  
  // Grupa 60 - Prihodi od prodaje robe
  { code: "60", name: "Prihodi od prodaje robe", account_type: "revenue", parent_code: "6", level: 2, is_posting_allowed: false },
  { code: "600", name: "Prihodi od prodaje robe povezanim pravnim licima", account_type: "revenue", parent_code: "60", level: 3, is_posting_allowed: true },
  { code: "601", name: "Prihodi od prodaje robe na domaćem tržištu", account_type: "revenue", parent_code: "60", level: 3, is_posting_allowed: true },
  { code: "602", name: "Prihodi od prodaje robe na inostranom tržištu", account_type: "revenue", parent_code: "60", level: 3, is_posting_allowed: true },
  
  // Grupa 61 - Prihodi od prodaje proizvoda i usluga
  { code: "61", name: "Prihodi od prodaje proizvoda i usluga", account_type: "revenue", parent_code: "6", level: 2, is_posting_allowed: false },
  { code: "610", name: "Prihodi od prodaje proizvoda i usluga povezanim pravnim licima", account_type: "revenue", parent_code: "61", level: 3, is_posting_allowed: true },
  { code: "611", name: "Prihodi od prodaje proizvoda i usluga na domaćem tržištu", account_type: "revenue", parent_code: "61", level: 3, is_posting_allowed: true },
  { code: "612", name: "Prihodi od prodaje proizvoda i usluga na inostranom tržištu", account_type: "revenue", parent_code: "61", level: 3, is_posting_allowed: true },
  { code: "613", name: "Prihodi od aktiviranja učinaka i robe", account_type: "revenue", parent_code: "61", level: 3, is_posting_allowed: true },
  
  // Grupa 62 - Prihodi od aktiviranja učinaka i robe
  { code: "62", name: "Prihodi od aktiviranja učinaka i robe", account_type: "revenue", parent_code: "6", level: 2, is_posting_allowed: false },
  { code: "620", name: "Prihodi od aktiviranja ili potrošnje proizvoda za sopstvene potrebe", account_type: "revenue", parent_code: "62", level: 3, is_posting_allowed: true },
  { code: "621", name: "Prihodi od aktiviranja ili potrošnje robe za sopstvene potrebe", account_type: "revenue", parent_code: "62", level: 3, is_posting_allowed: true },
  { code: "622", name: "Prihodi od aktiviranja ili potrošnje usluga za sopstvene potrebe", account_type: "revenue", parent_code: "62", level: 3, is_posting_allowed: true },
  
  // Grupa 63 - Promena vrednosti zaliha učinaka
  { code: "63", name: "Promena vrednosti zaliha učinaka", account_type: "revenue", parent_code: "6", level: 2, is_posting_allowed: false },
  { code: "630", name: "Povećanje vrednosti zaliha nedovršene proizvodnje", account_type: "revenue", parent_code: "63", level: 3, is_posting_allowed: true },
  { code: "631", name: "Povećanje vrednosti zaliha gotovih proizvoda", account_type: "revenue", parent_code: "63", level: 3, is_posting_allowed: true },
  { code: "632", name: "Smanjenje vrednosti zaliha nedovršene proizvodnje", account_type: "revenue", parent_code: "63", level: 3, is_posting_allowed: true },
  { code: "633", name: "Smanjenje vrednosti zaliha gotovih proizvoda", account_type: "revenue", parent_code: "63", level: 3, is_posting_allowed: true },
  
  // Grupa 64 - Prihodi od premija, subvencija, dotacija, donacija i sl.
  { code: "64", name: "Prihodi od premija, subvencija, dotacija, donacija i sl.", account_type: "revenue", parent_code: "6", level: 2, is_posting_allowed: false },
  { code: "640", name: "Prihodi od premija, subvencija, dotacija, regresa, kompenzacija i povraćaja poreza", account_type: "revenue", parent_code: "64", level: 3, is_posting_allowed: true },
  { code: "641", name: "Prihodi od donacija i od prenesenih sredstava iz budžeta", account_type: "revenue", parent_code: "64", level: 3, is_posting_allowed: true },
  
  // Grupa 65 - Drugi poslovni prihodi
  { code: "65", name: "Drugi poslovni prihodi", account_type: "revenue", parent_code: "6", level: 2, is_posting_allowed: false },
  { code: "650", name: "Prihodi od zakupnina", account_type: "revenue", parent_code: "65", level: 3, is_posting_allowed: true },
  { code: "651", name: "Prihodi od članarina", account_type: "revenue", parent_code: "65", level: 3, is_posting_allowed: true },
  { code: "652", name: "Prihodi od tantijema, patenata, licenci, koncesija i franšiza", account_type: "revenue", parent_code: "65", level: 3, is_posting_allowed: true },
  { code: "659", name: "Ostali poslovni prihodi", account_type: "revenue", parent_code: "65", level: 3, is_posting_allowed: true },
  
  // Grupa 66 - Finansijski prihodi
  { code: "66", name: "Finansijski prihodi", account_type: "revenue", parent_code: "6", level: 2, is_posting_allowed: false },
  { code: "660", name: "Finansijski prihodi od povezanih pravnih lica", account_type: "revenue", parent_code: "66", level: 3, is_posting_allowed: true },
  { code: "661", name: "Prihodi od kamata", account_type: "revenue", parent_code: "66", level: 3, is_posting_allowed: true },
  { code: "662", name: "Pozitivne kursne razlike", account_type: "revenue", parent_code: "66", level: 3, is_posting_allowed: true },
  { code: "663", name: "Prihodi po osnovu efekata ugovorene valutne klauzule", account_type: "revenue", parent_code: "66", level: 3, is_posting_allowed: true },
  { code: "664", name: "Prihodi od dividendi i učešća u dobitku", account_type: "revenue", parent_code: "66", level: 3, is_posting_allowed: true },
  { code: "669", name: "Ostali finansijski prihodi", account_type: "revenue", parent_code: "66", level: 3, is_posting_allowed: true },
  
  // Grupa 67 - Ostali prihodi
  { code: "67", name: "Ostali prihodi", account_type: "revenue", parent_code: "6", level: 2, is_posting_allowed: false },
  { code: "670", name: "Dobici od prodaje nematerijalnih ulaganja, nekretnina, postrojenja i opreme", account_type: "revenue", parent_code: "67", level: 3, is_posting_allowed: true },
  { code: "671", name: "Dobici od prodaje učešća i hartija od vrednosti", account_type: "revenue", parent_code: "67", level: 3, is_posting_allowed: true },
  { code: "672", name: "Dobici od prodaje materijala", account_type: "revenue", parent_code: "67", level: 3, is_posting_allowed: true },
  { code: "673", name: "Viškovi", account_type: "revenue", parent_code: "67", level: 3, is_posting_allowed: true },
  { code: "674", name: "Naplaćena otpisana potraživanja", account_type: "revenue", parent_code: "67", level: 3, is_posting_allowed: true },
  { code: "675", name: "Prihodi od smanjenja obaveza", account_type: "revenue", parent_code: "67", level: 3, is_posting_allowed: true },
  { code: "676", name: "Prihodi od ukidanja neiskorišćenih dugoročnih rezervisanja", account_type: "revenue", parent_code: "67", level: 3, is_posting_allowed: true },
  { code: "679", name: "Ostali nepomenuti prihodi", account_type: "revenue", parent_code: "67", level: 3, is_posting_allowed: true },
  
  // Grupa 68 - Prihodi od usklađivanja vrednosti imovine
  { code: "68", name: "Prihodi od usklađivanja vrednosti imovine", account_type: "revenue", parent_code: "6", level: 2, is_posting_allowed: false },
  { code: "680", name: "Prihodi od usklađivanja vrednosti bioloških sredstava", account_type: "revenue", parent_code: "68", level: 3, is_posting_allowed: true },
  { code: "681", name: "Prihodi od usklađivanja vrednosti nematerijalne imovine", account_type: "revenue", parent_code: "68", level: 3, is_posting_allowed: true },
  { code: "682", name: "Prihodi od usklađivanja vrednosti nekretnina, postrojenja i opreme", account_type: "revenue", parent_code: "68", level: 3, is_posting_allowed: true },
  { code: "683", name: "Prihodi od usklađivanja vrednosti dugoročnih finansijskih plasmana", account_type: "revenue", parent_code: "68", level: 3, is_posting_allowed: true },
  { code: "684", name: "Prihodi od usklađivanja vrednosti zaliha", account_type: "revenue", parent_code: "68", level: 3, is_posting_allowed: true },
  { code: "685", name: "Prihodi od usklađivanja vrednosti potraživanja i kratkoročnih finansijskih plasmana", account_type: "revenue", parent_code: "68", level: 3, is_posting_allowed: true },
  { code: "689", name: "Prihodi od usklađivanja vrednosti ostale imovine", account_type: "revenue", parent_code: "68", level: 3, is_posting_allowed: true },
  
  // Grupa 69 - Odloženi poreski prihodi
  { code: "69", name: "Odloženi poreski prihodi", account_type: "revenue", parent_code: "6", level: 2, is_posting_allowed: false },
  { code: "690", name: "Odloženi poreski prihodi perioda", account_type: "revenue", parent_code: "69", level: 3, is_posting_allowed: true },

  // ============================================
  // KLASA 7 - OTVARANJE I ZAKLJUČAK RAČUNA USPEHA
  // ============================================
  { code: "7", name: "OTVARANJE I ZAKLJUČAK RAČUNA STANJA I USPEHA", account_type: "asset", parent_code: null, level: 1, is_posting_allowed: false },
  
  // Grupa 70 - Otvaranje glavne knjige
  { code: "70", name: "Otvaranje glavne knjige", account_type: "asset", parent_code: "7", level: 2, is_posting_allowed: false },
  { code: "700", name: "Otvaranje glavne knjige", account_type: "asset", parent_code: "70", level: 3, is_posting_allowed: true },
  
  // Grupa 71 - Zaključak računa stanja
  { code: "71", name: "Zaključak računa stanja", account_type: "asset", parent_code: "7", level: 2, is_posting_allowed: false },
  { code: "710", name: "Zaključak računa stanja", account_type: "asset", parent_code: "71", level: 3, is_posting_allowed: true },
  
  // Grupa 72 - Račun dobitka i gubitka
  { code: "72", name: "Račun dobitka i gubitka", account_type: "asset", parent_code: "7", level: 2, is_posting_allowed: false },
  { code: "720", name: "Dobitak", account_type: "revenue", parent_code: "72", level: 3, is_posting_allowed: true },
  { code: "721", name: "Gubitak", account_type: "expense", parent_code: "72", level: 3, is_posting_allowed: true },

  // ============================================
  // KLASA 8 - VANBILANSNA AKTIVA
  // ============================================
  { code: "8", name: "VANBILANSNA AKTIVA", account_type: "asset", parent_code: null, level: 1, is_posting_allowed: false },
  
  { code: "88", name: "Vanbilansna aktiva", account_type: "asset", parent_code: "8", level: 2, is_posting_allowed: false },
  { code: "880", name: "Tuđa sredstva", account_type: "asset", parent_code: "88", level: 3, is_posting_allowed: true },
  { code: "881", name: "Preuzete neizvršene obaveze", account_type: "asset", parent_code: "88", level: 3, is_posting_allowed: true },
  { code: "882", name: "Izdate garancije", account_type: "asset", parent_code: "88", level: 3, is_posting_allowed: true },
  { code: "883", name: "Data jemstva, avali i kaucije", account_type: "asset", parent_code: "88", level: 3, is_posting_allowed: true },
  { code: "889", name: "Ostala vanbilansna aktiva", account_type: "asset", parent_code: "88", level: 3, is_posting_allowed: true },

  // ============================================
  // KLASA 9 - VANBILANSNA PASIVA
  // ============================================
  { code: "9", name: "VANBILANSNA PASIVA", account_type: "liability", parent_code: null, level: 1, is_posting_allowed: false },
  
  { code: "99", name: "Vanbilansna pasiva", account_type: "liability", parent_code: "9", level: 2, is_posting_allowed: false },
  { code: "990", name: "Obaveze za tuđa sredstva", account_type: "liability", parent_code: "99", level: 3, is_posting_allowed: true },
  { code: "991", name: "Potencijalne obaveze po preuzetim neizvršenim obavezama", account_type: "liability", parent_code: "99", level: 3, is_posting_allowed: true },
  { code: "992", name: "Potencijalne obaveze po izdatim garancijama", account_type: "liability", parent_code: "99", level: 3, is_posting_allowed: true },
  { code: "993", name: "Potencijalne obaveze po datim jemstvima, avalima i kaucijama", account_type: "liability", parent_code: "99", level: 3, is_posting_allowed: true },
  { code: "999", name: "Ostala vanbilansna pasiva", account_type: "liability", parent_code: "99", level: 3, is_posting_allowed: true },
];
