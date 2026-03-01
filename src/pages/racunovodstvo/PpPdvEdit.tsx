import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePpPdvReturnDetail, usePpPdvReturnMutations } from "@/hooks/usePpPdvReturns";
import { usePopdvReportCells } from "@/hooks/usePopdvReports";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Lock, RefreshCw, Download } from "lucide-react";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { toast } from "sonner";
import { generatePpPdvXml } from "@/lib/ppPdvXmlGenerator";

interface PpPdvField {
  code: string;
  label: string;
  section: string;
  isCalculated?: boolean;
  formula?: string;
}

const PP_PDV_FIELDS: PpPdvField[] = [
  // I. Promet dobara i usluga
  { code: "field_001", label: "Promet dobara i usluga po opštoj stopi - osnovica", section: "I" },
  { code: "field_002", label: "Obračunati PDV po opštoj stopi (20%)", section: "I" },
  { code: "field_003", label: "Promet dobara i usluga po posebnoj stopi - osnovica", section: "I" },
  { code: "field_004", label: "Obračunati PDV po posebnoj stopi (10%)", section: "I" },
  { code: "field_005", label: "Promet oslobođen PDV sa pravom na odbitak preth. poreza", section: "I" },
  { code: "field_006", label: "Promet oslobođen PDV bez prava na odbitak preth. poreza", section: "I" },
  { code: "field_007", label: "Promet koji nije predmet oporezivanja PDV", section: "I" },
  { code: "field_008", label: "Ukupan promet (001+003+005+006+007)", section: "I", isCalculated: true, formula: "001+003+005+006+007" },

  // II. PDV iz avansa
  { code: "field_009", label: "PDV iz primljenih avansa po opštoj stopi (20%)", section: "II" },
  { code: "field_010", label: "PDV iz primljenih avansa po posebnoj stopi (10%)", section: "II" },

  // III. Ukupna poreska obaveza
  { code: "field_011", label: "Ukupna poreska obaveza (002+004+009+010)", section: "III", isCalculated: true, formula: "002+004+009+010" },

  // IV. Prethodni porez
  { code: "field_101", label: "Prethodni PDV po opštoj stopi - dobra", section: "IV" },
  { code: "field_102", label: "Prethodni PDV po posebnoj stopi - dobra", section: "IV" },
  { code: "field_103", label: "Prethodni PDV po opštoj stopi - usluge", section: "IV" },
  { code: "field_104", label: "Prethodni PDV po posebnoj stopi - usluge", section: "IV" },
  { code: "field_105", label: "Prethodni PDV plaćen pri uvozu dobara", section: "IV" },
  { code: "field_106", label: "Ispravka prethodnog poreza - povećanje", section: "IV" },
  { code: "field_107", label: "Ispravka prethodnog poreza - smanjenje", section: "IV" },
  { code: "field_108", label: "Ukupan prethodni porez (101+102+103+104+105+106-107)", section: "IV", isCalculated: true, formula: "101+102+103+104+105+106-107" },

  // V. PDV za uplatu / povraćaj
  { code: "field_201", label: "PDV za uplatu u budžet (011-108, ako >0)", section: "V", isCalculated: true },
  { code: "field_202", label: "Iznos za povraćaj (108-011, ako >0)", section: "V", isCalculated: true },
];

const SECTION_HEADERS: Record<string, string> = {
  "I": "I. Promet dobara i usluga",
  "II": "II. PDV iz primljenih avansa",
  "III": "III. Ukupna poreska obaveza",
  "IV": "IV. Prethodni porez",
  "V": "V. Poreska obaveza za uplatu / iznos za povraćaj",
};

export default function PpPdvEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const returnQuery = usePpPdvReturnDetail(id);
  const { updateFields, finalizeReturn } = usePpPdvReturnMutations(id);
  const [calculating, setCalculating] = useState(false);

  const ret = returnQuery.data;
  const isDraft = ret?.status === "draft";

  // Cells from linked POPDV
  const { cellsQuery } = usePopdvReportCells(ret?.popdv_report_id || undefined);

  const getFieldValue = useCallback((code: string): number => {
    if (!ret) return 0;
    return Number((ret as any)[code]) || 0;
  }, [ret]);

  const handleFieldChange = useCallback((code: string, value: number) => {
    updateFields.mutate({ [code]: value });
  }, [updateFields]);

  const recalculate = useCallback(() => {
    if (!ret) return;
    const f = (code: string) => Number((ret as any)[`field_${code}`]) || 0;
    
    const field_008 = f("001") + f("003") + f("005") + f("006") + f("007");
    const field_011 = f("002") + f("004") + f("009") + f("010");
    const field_108 = f("101") + f("102") + f("103") + f("104") + f("105") + f("106") - f("107");
    const diff = field_011 - field_108;
    const field_201 = diff > 0 ? diff : 0;
    const field_202 = diff < 0 ? Math.abs(diff) : 0;

    updateFields.mutate({
      field_008,
      field_011,
      field_108,
      field_201,
      field_202,
    });
    toast.success("Izračunata polja ažurirana");
  }, [ret, updateFields]);

  const handleAutoPopulateFromPopdv = async () => {
    if (!ret?.popdv_report_id) {
      toast.error("Nema povezanog POPDV obrasca");
      return;
    }
    setCalculating(true);
    try {
      const cells = cellsQuery.data || [];
      const cellVal = (rowCode: string, colCode: string) => {
        const cell = cells.find(c => c.row_code === rowCode && c.column_code === colCode);
        if (!cell) return 0;
        return cell.manual_override !== null ? cell.manual_override : cell.auto_value;
      };

      // Map POPDV cells to PP-PDV fields
      const updates: Record<string, number> = {};

      // Section 1 -> field_001 (osnov at 20%) & field_002 (pdv at 20%)
      updates.field_001 = cellVal("1.1", "osnov");
      updates.field_002 = cellVal("1.1", "pdv");

      // Section 1 special rate -> field_003, field_004
      updates.field_003 = cellVal("1.2", "osnov");
      updates.field_004 = cellVal("1.2", "pdv");

      // Exempt with right
      updates.field_005 = cellVal("1.3", "osnov") + cellVal("1.4", "osnov");
      // Exempt without right
      updates.field_006 = cellVal("1.5", "osnov");

      // Advances
      updates.field_009 = cellVal("1.6", "pdv");

      // Input VAT - goods
      updates.field_101 = cellVal("5.1", "pdv");
      // Input VAT - services
      updates.field_103 = cellVal("5.3", "pdv");
      // Correction - decrease (credit notes)
      updates.field_107 = cellVal("6.2", "iznos");

      // Calculate totals
      updates.field_008 = (updates.field_001 || 0) + (updates.field_003 || 0) + (updates.field_005 || 0) + (updates.field_006 || 0) + (updates.field_007 || 0);
      updates.field_011 = (updates.field_002 || 0) + (updates.field_004 || 0) + (updates.field_009 || 0) + (updates.field_010 || 0);
      updates.field_108 = (updates.field_101 || 0) + (updates.field_102 || 0) + (updates.field_103 || 0) + (updates.field_104 || 0) + (updates.field_105 || 0) + (updates.field_106 || 0) - (updates.field_107 || 0);
      
      const diff = updates.field_011 - updates.field_108;
      updates.field_201 = diff > 0 ? diff : 0;
      updates.field_202 = diff < 0 ? Math.abs(diff) : 0;

      await updateFields.mutateAsync(updates);
      toast.success("Podaci preuzeti iz POPDV obrasca");
    } catch {
      toast.error("Greška pri preuzimanju podataka");
    } finally {
      setCalculating(false);
    }
  };

  const handleExportXml = () => {
    if (!ret) return;
    try {
      const xml = generatePpPdvXml(ret);
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PP-PDV_${ret.period_label.replace(/\s+/g, "_")}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("XML fajl preuzet");
    } catch {
      toast.error("Greška pri generisanju XML-a");
    }
  };

  if (returnQuery.isLoading) {
    return <MainLayout title="PP-PDV"><div className="p-8 text-center text-muted-foreground">Učitavanje...</div></MainLayout>;
  }
  if (!ret) {
    return <MainLayout title="PP-PDV"><div className="p-8 text-center text-muted-foreground">Prijava nije pronađena</div></MainLayout>;
  }

  let currentSection = "";

  return (
    <MainLayout title={`PP-PDV — ${ret.period_label}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/racunovodstvo/pp-pdv")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">PP-PDV — {ret.period_label}</h1>
              <p className="text-sm text-muted-foreground">
                {ret.period_start} — {ret.period_end}
                {ret.pib && ` | PIB: ${ret.pib}`}
              </p>
            </div>
            <span className={ret.status === "finalized" ? "erp-badge-success" : "erp-badge-warning"}>
              {ret.status === "finalized" ? "Zaključena" : "Nacrt"}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isDraft && ret.popdv_report_id && (
              <Button variant="outline" size="sm" onClick={handleAutoPopulateFromPopdv} disabled={calculating}>
                <RefreshCw className={`w-4 h-4 mr-2 ${calculating ? "animate-spin" : ""}`} />
                Preuzmi iz POPDV
              </Button>
            )}
            {isDraft && (
              <Button variant="outline" size="sm" onClick={recalculate}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Preračunaj
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExportXml}>
              <Download className="w-4 h-4 mr-2" />
              XML za ePoreze
            </Button>
            {isDraft && (
              <Button
                size="sm"
                onClick={() => {
                  if (confirm("Zaključiti ovu PP-PDV prijavu?")) {
                    finalizeReturn.mutate();
                  }
                }}
                disabled={finalizeReturn.isPending}
              >
                <Lock className="w-4 h-4 mr-2" />
                Zaključi
              </Button>
            )}
          </div>
        </div>

        <div className="erp-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Polje</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="w-[200px] text-right">Iznos (RSD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PP_PDV_FIELDS.map((field) => {
                const showHeader = field.section !== currentSection;
                currentSection = field.section;
                const value = getFieldValue(field.code);
                const fieldNum = field.code.replace("field_", "");

                return (
                  <>
                    {showHeader && (
                      <TableRow key={`header-${field.section}`} className="bg-muted/70">
                        <TableCell colSpan={3} className="font-semibold text-sm">
                          {SECTION_HEADERS[field.section]}
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow key={field.code} className={field.isCalculated ? "bg-muted/30 font-semibold" : ""}>
                      <TableCell className="font-mono text-xs">{fieldNum}</TableCell>
                      <TableCell className="text-sm">{field.label}</TableCell>
                      <TableCell className="p-1">
                        {field.isCalculated || !isDraft ? (
                          <div className="text-right font-mono tabular-nums pr-3">
                            {value.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        ) : (
                          <LocaleNumberInput
                            value={String(value)}
                            onChange={(v) => {
                              const num = parseFloat(v) || 0;
                              handleFieldChange(field.code, num);
                            }}
                            decimalPlaces={2}
                            className="text-right h-8"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
