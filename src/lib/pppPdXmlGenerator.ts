import type { PayrollCalculationItem } from "@/hooks/usePayrollCalculations";

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtAmount(val: number | string | null | undefined): string {
  const n = Number(val) || 0;
  return n.toFixed(2);
}

export interface PppPdData {
  /** 1=prvobitna, 3=izmenjena, 4=storniranje */
  vrstaPrijave: string;
  /** Datum placanja YYYY-MM-DD */
  datumPlacanja: string;
  /** Datum nastanka obaveze YYYY-MM-DD */
  datumOstvarivanja: string;
  /** PIB isplatioca */
  pib: string;
  /** Matični broj */
  mb?: string;
  /** Naziv isplatioca */
  nazivIsplatioca: string;
  /** Ime i prezime odgovornog lica */
  odgovornoLice?: string;
  /** Grad */
  sediste?: string;
  /** Email */
  email?: string;
  /** Telefon */
  telefon?: string;
  /** Opština */
  opstina?: string;
  /** calculation_type from payroll calculation */
  calculationType: string;
  /** Period month */
  periodMonth: number;
  /** Period year */
  periodYear: number;
  /** Items with employee data */
  items: PppPdItemData[];
}

export interface PppPdItemData {
  redBr: number;
  /** Primalac prihoda: 01=zaposleni, 02=osnivač, 08=nerezident, 09=PIO osiguranik, 10=penzioner, 12=svi, 13=menadžer */
  primalacPrihoda: string;
  /** Vrsta identifikacije: 1=JMBG, 2=EBS, 3=PIB */
  vrstaIdentifikacije: string;
  identifikacioniBroj: string;
  imePrezime: string;
  /** Šifra vrste prihoda: format "B OL OVP" npr "1 01 101 00 0" */
  sifraVrstePrihoda: string;
  brutoP: number;
  osnovicaZaPorez: number;
  porez: number;
  osnovicaZaDoprinose: number;
  pioZaposleni: number;
  zdravstvoZaposleni: number;
  nezaposlenost: number;
  pioPoslodavac: number;
  zdravstvoPoslodavac: number;
  mfp?: number;  // benefited work (default 0)
}

/**
 * Maps payroll calculation_type to PPP-PD income type code (OVP part)
 * and receiver code (PP)
 */
function getIncomeTypeInfo(calcType: string): { pp: string; ovp: string; ol: string; b: string } {
  switch (calcType) {
    case "redovna_zarada":
      return { pp: "01", ovp: "101", ol: "00", b: "0" };
    case "bolovanje_poslodavac":
      return { pp: "01", ovp: "102", ol: "00", b: "0" };
    case "bolovanje_rfzo":
      return { pp: "01", ovp: "201", ol: "00", b: "0" };
    case "ugovor_o_delu":
      return { pp: "12", ovp: "601", ol: "00", b: "0" };
    case "autorski_ugovor":
      return { pp: "12", ovp: "602", ol: "00", b: "0" };
    case "vlasnik":
      return { pp: "02", ovp: "101", ol: "00", b: "0" };
    case "penzioner":
      return { pp: "10", ovp: "101", ol: "00", b: "0" };
    default:
      return { pp: "01", ovp: "101", ol: "00", b: "0" };
  }
}

/**
 * Generates PPP-PD XML in the format expected by ePorezi portal.
 */
export function generatePppPdXml(data: PppPdData): string {
  const incomeInfo = getIncomeTypeInfo(data.calculationType);

  const itemsXml = data.items.map((item) => {
    const sifra = `${incomeInfo.b} ${incomeInfo.ol} ${incomeInfo.ovp} ${incomeInfo.pp}`;
    return `    <PodaciOPrimaocu>
      <RedniBroj>${item.redBr}</RedniBroj>
      <PPO>${escapeXml(incomeInfo.pp)}</PPO>
      <VrstaIdentifikacije>${escapeXml(item.vrstaIdentifikacije)}</VrstaIdentifikacije>
      <IdentifikacioniBroj>${escapeXml(item.identifikacioniBroj)}</IdentifikacioniBroj>
      <ImePrezime>${escapeXml(item.imePrezime)}</ImePrezime>
      <SifraVrstePrihoda>${escapeXml(sifra)}</SifraVrstePrihoda>
      <BrutoPrihod>${fmtAmount(item.brutoP)}</BrutoPrihod>
      <OsnovicaZaPorez>${fmtAmount(item.osnovicaZaPorez)}</OsnovicaZaPorez>
      <Porez>${fmtAmount(item.porez)}</Porez>
      <OsnovicaZaDoprinose>${fmtAmount(item.osnovicaZaDoprinose)}</OsnovicaZaDoprinose>
      <PIOZaposleni>${fmtAmount(item.pioZaposleni)}</PIOZaposleni>
      <ZdravstvoZaposleni>${fmtAmount(item.zdravstvoZaposleni)}</ZdravstvoZaposleni>
      <Nezaposlenost>${fmtAmount(item.nezaposlenost)}</Nezaposlenost>
      <PIOPoslodavac>${fmtAmount(item.pioPoslodavac)}</PIOPoslodavac>
      <ZdravstvoPoslodavac>${fmtAmount(item.zdravstvoPoslodavac)}</ZdravstvoPoslodavac>
      <MFP>${fmtAmount(item.mfp || 0)}</MFP>
    </PodaciOPrimaocu>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PoreskaPrijava xmlns="http://pid.purs.gov.rs/ppp_pd">
  <PodaciOPrijavi>
    <VrstaPrijave>${escapeXml(data.vrstaPrijave)}</VrstaPrijave>
    <DatumPlacanja>${escapeXml(data.datumPlacanja)}</DatumPlacanja>
    <DatumOstvarivanja>${escapeXml(data.datumOstvarivanja)}</DatumOstvarivanja>
    <ObracunskiPeriod>
      <Mesec>${data.periodMonth}</Mesec>
      <Godina>${data.periodYear}</Godina>
    </ObracunskiPeriod>
  </PodaciOPrijavi>
  <PodaciOIsplatiocu>
    <TipIsplatioca>1</TipIsplatioca>
    <PIB>${escapeXml(data.pib)}</PIB>
    <MB>${escapeXml(data.mb)}</MB>
    <NazivIsplatioca>${escapeXml(data.nazivIsplatioca)}</NazivIsplatioca>
    <Sediste>${escapeXml(data.sediste)}</Sediste>
    <Telefon>${escapeXml(data.telefon)}</Telefon>
    <EMail>${escapeXml(data.email)}</EMail>
  </PodaciOIsplatiocu>
  <PodaciOPrimaocima>
${itemsXml}
  </PodaciOPrimaocima>
</PoreskaPrijava>`;

  return xml;
}

/**
 * Helper: build PppPdItemData from calculation items and employee info
 */
export function buildPppPdItems(
  items: Partial<PayrollCalculationItem>[],
  employeeMap: Record<string, { jmbg?: string; first_name?: string; last_name?: string }>
): PppPdItemData[] {
  return items.map((item, idx) => {
    const emp = employeeMap[item.employee_id || ""];
    const bruto = (item.gross_salary || 0) + (item.seniority_bonus || 0) + (item.regres || 0) +
      (item.meal_allowance || 0) + (item.transport_allowance || 0) + (item.other_additions || 0);

    return {
      redBr: idx + 1,
      primalacPrihoda: "01",
      vrstaIdentifikacije: "1",
      identifikacioniBroj: emp?.jmbg || "",
      imePrezime: item.employee_name || `${emp?.last_name || ""} ${emp?.first_name || ""}`,
      sifraVrstePrihoda: "",
      brutoP: bruto,
      osnovicaZaPorez: item.tax_base || 0,
      porez: item.income_tax || 0,
      osnovicaZaDoprinose: bruto,
      pioZaposleni: item.pio_employee || 0,
      zdravstvoZaposleni: item.health_employee || 0,
      nezaposlenost: item.unemployment || 0,
      pioPoslodavac: item.pio_employer || 0,
      zdravstvoPoslodavac: item.health_employer || 0,
      mfp: 0,
    };
  });
}
