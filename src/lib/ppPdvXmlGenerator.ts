import type { PpPdvReturn } from "@/hooks/usePpPdvReturns";

function escapeXml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtAmount(val: number | string | null | undefined): string {
  const n = Number(val) || 0;
  return n.toFixed(2);
}

/**
 * Generates PP-PDV XML in the format expected by the Serbian Tax Authority (ePoreze portal).
 * Based on the official PP-PDV form structure.
 */
export function generatePpPdvXml(ret: PpPdvReturn): string {
  const periodStart = ret.period_start;
  const periodEnd = ret.period_end;

  // Determine period type code: 1=monthly, 3=quarterly
  const periodTypeCode = ret.period_type === "monthly" ? "1" : "3";

  // Extract month/quarter number from dates
  const startDate = new Date(periodStart);
  const periodNumber = ret.period_type === "monthly"
    ? String(startDate.getMonth() + 1)
    : String(Math.floor(startDate.getMonth() / 3) + 1);

  const year = String(startDate.getFullYear());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PoreskaPrijava xmlns="http://pid.purs.gov.rs/pp_pdv">
  <Zaglavlje>
    <VrstaPrijave>1</VrstaPrijave>
    <VrstaPerioda>${escapeXml(periodTypeCode)}</VrstaPerioda>
    <Period>${escapeXml(periodNumber)}</Period>
    <Godina>${escapeXml(year)}</Godina>
    <DatumOd>${escapeXml(periodStart)}</DatumOd>
    <DatumDo>${escapeXml(periodEnd)}</DatumDo>
  </Zaglavlje>
  <PodaciOObvezniku>
    <PIB>${escapeXml(ret.pib)}</PIB>
    <NazivObveznika>${escapeXml(ret.company_name)}</NazivObveznika>
    <SifraOpstine>${escapeXml(ret.municipality_code)}</SifraOpstine>
    <SifraDelatnosti>${escapeXml(ret.activity_code)}</SifraDelatnosti>
    <Email>${escapeXml(ret.email)}</Email>
    <OdgovornoLice>
      <ImePrezime>${escapeXml(ret.responsible_person_name)}</ImePrezime>
      <JMBG>${escapeXml(ret.responsible_person_jmbg)}</JMBG>
    </OdgovornoLice>
  </PodaciOObvezniku>
  <PrometDobaraIUsluga>
    <OpstiStopa>
      <Osnovica>${fmtAmount(ret.field_001)}</Osnovica>
      <ObracunatiPDV>${fmtAmount(ret.field_002)}</ObracunatiPDV>
    </OpstiStopa>
    <PosebnaStopa>
      <Osnovica>${fmtAmount(ret.field_003)}</Osnovica>
      <ObracunatiPDV>${fmtAmount(ret.field_004)}</ObracunatiPDV>
    </PosebnaStopa>
    <OslobodjenSaPravom>${fmtAmount(ret.field_005)}</OslobodjenSaPravom>
    <OslobodjenBezPrava>${fmtAmount(ret.field_006)}</OslobodjenBezPrava>
    <NijePredmetOporezivanja>${fmtAmount(ret.field_007)}</NijePredmetOporezivanja>
    <UkupanPromet>${fmtAmount(ret.field_008)}</UkupanPromet>
  </PrometDobaraIUsluga>
  <PDVIzAvansa>
    <OpstiStopa>${fmtAmount(ret.field_009)}</OpstiStopa>
    <PosebnaStopa>${fmtAmount(ret.field_010)}</PosebnaStopa>
  </PDVIzAvansa>
  <UkupnaPoreskaObaveza>${fmtAmount(ret.field_011)}</UkupnaPoreskaObaveza>
  <PrethodniPorez>
    <OpstiStopaDobra>${fmtAmount(ret.field_101)}</OpstiStopaDobra>
    <PosebnaStopaDobra>${fmtAmount(ret.field_102)}</PosebnaStopaDobra>
    <OpstiStopaUsluge>${fmtAmount(ret.field_103)}</OpstiStopaUsluge>
    <PosebnaStopaUsluge>${fmtAmount(ret.field_104)}</PosebnaStopaUsluge>
    <PlacenPriUvozu>${fmtAmount(ret.field_105)}</PlacenPriUvozu>
    <IspravkaPovecanje>${fmtAmount(ret.field_106)}</IspravkaPovecanje>
    <IspravkaSmanjenje>${fmtAmount(ret.field_107)}</IspravkaSmanjenje>
    <UkupanPrethodniPorez>${fmtAmount(ret.field_108)}</UkupanPrethodniPorez>
  </PrethodniPorez>
  <PoreskaObaveza>
    <ZaUplatu>${fmtAmount(ret.field_201)}</ZaUplatu>
    <ZaPovracaj>${fmtAmount(ret.field_202)}</ZaPovracaj>
  </PoreskaObaveza>
</PoreskaPrijava>`;

  return xml;
}
