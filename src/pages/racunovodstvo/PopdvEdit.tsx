import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePopdvReportDetail, usePopdvReportCells, useFinalizePopdvReport } from "@/hooks/usePopdvReports";
import { POPDV_SECTIONS, PopdvSection, PopdvRow } from "@/data/popdvFormStructure";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Lock, RefreshCw, Check } from "lucide-react";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function PopdvEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const reportQuery = usePopdvReportDetail(id);
  const { cellsQuery, updateCell } = usePopdvReportCells(id);
  const finalizeReport = useFinalizePopdvReport();
  const [activeSection, setActiveSection] = useState("1");
  const [calculating, setCalculating] = useState(false);

  const report = reportQuery.data;
  const cells = cellsQuery.data || [];
  const isDraft = report?.status === "draft";

  // Build a map for quick cell lookup
  const cellMap = useMemo(() => {
    const map = new Map<string, typeof cells[0]>();
    for (const c of cells) {
      map.set(`${c.row_code}:${c.column_code}`, c);
    }
    return map;
  }, [cells]);

  const getCellValue = useCallback((rowCode: string, colCode: string) => {
    const cell = cellMap.get(`${rowCode}:${colCode}`);
    if (!cell) return 0;
    return cell.manual_override !== null ? cell.manual_override : cell.auto_value;
  }, [cellMap]);

  const handleCellChange = useCallback((rowCode: string, colCode: string, value: number | null) => {
    const cell = cellMap.get(`${rowCode}:${colCode}`);
    if (!cell) return;
    updateCell.mutate({ cellId: cell.id, manual_override: value });
  }, [cellMap, updateCell]);

  const handleAutoPopulate = async () => {
    if (!report || !selectedCompany) return;
    setCalculating(true);
    try {
      // Fetch invoices for the period
      const { data: invoices } = await supabase
        .from("invoices")
        .select("subtotal, vat_amount, total_amount, status")
        .eq("company_id", selectedCompany.id)
        .eq("status", "posted")
        .gte("invoice_date", report.period_start)
        .lte("invoice_date", report.period_end);

      // Fetch advance invoices
      const { data: advances } = await supabase
        .from("advance_invoices")
        .select("subtotal, vat_amount, total_amount, status")
        .eq("company_id", selectedCompany.id)
        .eq("status", "posted")
        .gte("advance_date", report.period_start)
        .lte("advance_date", report.period_end);

      // Fetch credit notes
      const { data: creditNotes } = await supabase
        .from("credit_notes")
        .select("subtotal, vat_amount, total_amount, status")
        .eq("company_id", selectedCompany.id)
        .eq("status", "posted")
        .gte("credit_note_date", report.period_start)
        .lte("credit_note_date", report.period_end);

      // Fetch purchase invoices (goods)
      const { data: goodsPurchase } = await supabase
        .from("goods_purchase_invoices")
        .select("subtotal, vat_amount, total_amount, status")
        .eq("company_id", selectedCompany.id)
        .eq("status", "posted")
        .gte("invoice_date", report.period_start)
        .lte("invoice_date", report.period_end);

      // Fetch purchase invoices (services)
      const { data: servicePurchase } = await supabase
        .from("service_purchase_invoices")
        .select("subtotal, vat_amount, total_amount, status")
        .eq("company_id", selectedCompany.id)
        .eq("status", "posted")
        .gte("invoice_date", report.period_start)
        .lte("invoice_date", report.period_end);

      // Calculate totals
      const sumField = (arr: any[] | null, field: string) =>
        (arr || []).reduce((sum, item) => sum + (Number(item[field]) || 0), 0);

      const updates: { rowCode: string; colCode: string; value: number }[] = [];

      // 1.1 - Promet po opštoj stopi (simplified - all invoices as 20%)
      const invSubtotal = sumField(invoices, "subtotal");
      const invVat = sumField(invoices, "vat_amount");
      updates.push({ rowCode: "1.1", colCode: "osnov", value: invSubtotal });
      updates.push({ rowCode: "1.1", colCode: "pdv", value: invVat });

      // 1.6 - Avansna plaćanja
      const advSubtotal = sumField(advances, "subtotal");
      const advVat = sumField(advances, "vat_amount");
      updates.push({ rowCode: "1.6", colCode: "osnov", value: advSubtotal });
      updates.push({ rowCode: "1.6", colCode: "pdv", value: advVat });

      // 5.1 - Prethodni porez - dobra
      const gpSubtotal = sumField(goodsPurchase, "subtotal");
      const gpVat = sumField(goodsPurchase, "vat_amount");
      updates.push({ rowCode: "5.1", colCode: "osnov", value: gpSubtotal });
      updates.push({ rowCode: "5.1", colCode: "pdv", value: gpVat });

      // 5.3 - Prethodni porez - usluge
      const spSubtotal = sumField(servicePurchase, "subtotal");
      const spVat = sumField(servicePurchase, "vat_amount");
      updates.push({ rowCode: "5.3", colCode: "osnov", value: spSubtotal });
      updates.push({ rowCode: "5.3", colCode: "pdv", value: spVat });

      // 6.2 - Smanjenje prethodnog poreza (knjižna odobrenja)
      const cnVat = sumField(creditNotes, "vat_amount");
      updates.push({ rowCode: "6.2", colCode: "iznos", value: cnVat });

      // Apply updates
      for (const u of updates) {
        const cell = cellMap.get(`${u.rowCode}:${u.colCode}`);
        if (cell) {
          await supabase
            .from("popdv_report_cells")
            .update({ auto_value: u.value })
            .eq("id", cell.id);
        }
      }

      cellsQuery.refetch();
      toast.success("Automatski podaci preuzeti iz dokumenata");
    } catch (err) {
      toast.error("Greška pri preuzimanju podataka");
    } finally {
      setCalculating(false);
    }
  };

  if (reportQuery.isLoading || cellsQuery.isLoading) {
    return <MainLayout title="POPDV"><div className="p-8 text-center text-muted-foreground">Učitavanje...</div></MainLayout>;
  }

  if (!report) {
    return <MainLayout title="POPDV"><div className="p-8 text-center text-muted-foreground">Izveštaj nije pronađen</div></MainLayout>;
  }

  return (
    <MainLayout title={`POPDV — ${report.period_label}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/racunovodstvo/popdv")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">POPDV — {report.period_label}</h1>
              <p className="text-sm text-muted-foreground">
                {report.period_start} — {report.period_end}
              </p>
            </div>
            <span className={report.status === "finalized" ? "erp-badge-success" : "erp-badge-warning"}>
              {report.status === "finalized" ? "Zaključen" : "Nacrt"}
            </span>
          </div>
          <div className="flex gap-2">
            {isDraft && (
              <>
                <Button variant="outline" size="sm" onClick={handleAutoPopulate} disabled={calculating}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${calculating ? "animate-spin" : ""}`} />
                  Preuzmi iz dokumenata
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (confirm("Zaključiti ovaj POPDV obrazac? Posle zaključivanja neće biti moguće menjati vrednosti.")) {
                      finalizeReport.mutate(report.id);
                    }
                  }}
                  disabled={finalizeReport.isPending}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Zaključi
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Section Tabs */}
        <Tabs value={activeSection} onValueChange={setActiveSection}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {POPDV_SECTIONS.map((s) => (
              <TabsTrigger key={s.number} value={String(s.number)} className="text-xs">
                Deo {s.number}
              </TabsTrigger>
            ))}
          </TabsList>

          {POPDV_SECTIONS.map((section) => (
            <TabsContent key={section.number} value={String(section.number)}>
              <div className="erp-card">
                <div className="p-4 border-b">
                  <h2 className="font-semibold">Deo {section.number}: {section.title}</h2>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </div>
                <SectionTable
                  section={section}
                  cellMap={cellMap}
                  getCellValue={getCellValue}
                  onCellChange={handleCellChange}
                  readonly={!isDraft}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </MainLayout>
  );
}

interface SectionTableProps {
  section: PopdvSection;
  cellMap: Map<string, any>;
  getCellValue: (row: string, col: string) => number;
  onCellChange: (row: string, col: string, value: number | null) => void;
  readonly: boolean;
}

function SectionTable({ section, cellMap, getCellValue, onCellChange, readonly }: SectionTableProps) {
  // Get unique columns from the section
  const columns = section.rows[0]?.columns || [];

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Šifra</TableHead>
            <TableHead className="min-w-[300px]">Opis</TableHead>
            {columns.map((col) => (
              <TableHead key={col.code} className="w-[160px] text-right">{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {section.rows.map((row) => (
            <TableRow key={row.code} className={row.isSummary ? "bg-muted/50 font-semibold" : ""}>
              <TableCell className="font-mono text-xs">{row.code}</TableCell>
              <TableCell className="text-sm">{row.label}</TableCell>
              {row.columns.map((col) => {
                const cell = cellMap.get(`${row.code}:${col.code}`);
                const autoVal = cell?.auto_value || 0;
                const manualVal = cell?.manual_override;
                const displayVal = manualVal !== null && manualVal !== undefined ? manualVal : autoVal;
                const isOverridden = manualVal !== null && manualVal !== undefined;

                if (row.isSummary || readonly) {
                  return (
                    <TableCell key={col.code} className="text-right font-mono tabular-nums">
                      {displayVal.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  );
                }

                return (
                  <TableCell key={col.code} className="p-1">
                    <div className="relative">
                      <LocaleNumberInput
                        value={String(displayVal)}
                        onChange={(v) => {
                          const num = parseFloat(v) || 0;
                          onCellChange(row.code, col.code, num === autoVal ? null : num);
                        }}
                        decimalPlaces={2}
                        className={`text-right h-8 ${isOverridden ? "border-primary bg-primary/5" : ""}`}
                      />
                      {isOverridden && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" title={`Auto: ${autoVal.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}`} />
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
