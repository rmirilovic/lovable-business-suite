import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePopdvReportDetail, usePopdvReportCells, useFinalizePopdvReport } from "@/hooks/usePopdvReports";
import { POPDV_SECTIONS, PopdvSection, PopdvSubTable, PopdvRow, PopdvColumn, getAllCellKeys } from "@/data/popdvFormStructure";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Lock, RefreshCw, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parseLocaleNumber } from "@/lib/formatting";

export default function PopdvEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const reportQuery = usePopdvReportDetail(id);
  const { cellsQuery, updateCell } = usePopdvReportCells(id);
  const finalizeReport = useFinalizePopdvReport();
  const [activeSection, setActiveSection] = useState(() => {
    return sessionStorage.getItem(`popdv_section_${id}`) || "1";
  });

  const handleSectionChange = useCallback((value: string) => {
    setActiveSection(value);
    sessionStorage.setItem(`popdv_section_${id}`, value);
  }, [id]);
  const [calculating, setCalculating] = useState(false);

  const report = reportQuery.data;
  const cells = cellsQuery.data || [];
  const isDraft = report?.status === "draft";

  const cellMap = useMemo(() => {
    const map = new Map<string, typeof cells[0]>();
    for (const c of cells) {
      map.set(`${c.row_code}:${c.column_code}`, c);
    }
    return map;
  }, [cells]);

  // Auto-reinitialize cells if they're missing or incomplete
  const expectedCellKeys = useMemo(() => getAllCellKeys(), []);
  useEffect(() => {
    if (!report || !selectedCompany || cellsQuery.isLoading) return;
    const missingKeys = expectedCellKeys.filter(
      (ck) => !cellMap.has(`${ck.rowCode}:${ck.columnCode}`)
    );
    if (missingKeys.length === 0) return;

    const reinitCells = async () => {
      const newCells = missingKeys.map((ck) => ({
        report_id: report.id,
        company_id: selectedCompany.id,
        section: ck.section,
        row_code: ck.rowCode,
        column_code: ck.columnCode,
        auto_value: 0,
        manual_override: null,
      }));
      for (let i = 0; i < newCells.length; i += 100) {
        const batch = newCells.slice(i, i + 100);
        await supabase.from("popdv_report_cells").insert(batch);
      }
      cellsQuery.refetch();
    };
    reinitCells();
  }, [report, selectedCompany, cellMap, expectedCellKeys, cellsQuery.isLoading]);

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
      // Fetch all analytical detail rows for this report
      const { data: detailRows, error } = await supabase
        .from("popdv_report_detail_rows")
        .select("row_code, values")
        .eq("report_id", report.id);

      if (error) throw error;

      // Aggregate values by row_code and column_code
      const aggregated = new Map<string, Map<string, number>>();
      for (const row of (detailRows || [])) {
        const vals = (row.values || {}) as Record<string, number>;
        if (!aggregated.has(row.row_code)) {
          aggregated.set(row.row_code, new Map());
        }
        const rowMap = aggregated.get(row.row_code)!;
        for (const [colCode, val] of Object.entries(vals)) {
          rowMap.set(colCode, (rowMap.get(colCode) || 0) + (Number(val) || 0));
        }
      }

      // Update non-summary cells with aggregated values
      let updatedCount = 0;
      for (const [rowCode, colMap] of aggregated) {
        for (const [colCode, value] of colMap) {
          const cell = cellMap.get(`${rowCode}:${colCode}`);
          if (cell) {
            await supabase
              .from("popdv_report_cells")
              .update({ auto_value: value })
              .eq("id", cell.id);
            updatedCount++;
          }
        }
      }

      // Zero out non-summary cells that have no detail rows
      for (const [key, cell] of cellMap) {
        const [rowCode, colCode] = key.split(":");
        const hasDetail = aggregated.has(rowCode) && aggregated.get(rowCode)!.has(colCode);
        if (!hasDetail && cell.auto_value !== 0) {
          const section = POPDV_SECTIONS.find(s => s.subTables.some(st => st.rows.some(r => r.code === rowCode && !r.isSummary)));
          if (section) {
            await supabase
              .from("popdv_report_cells")
              .update({ auto_value: 0 })
              .eq("id", cell.id);
          }
        }
      }

      // Build a value map for computing summaries: rowCode -> colCode -> value
      // Start with aggregated detail values and existing non-summary cell values
      const valueMap = new Map<string, Map<string, number>>();
      for (const [key, cell] of cellMap) {
        const [rowCode, colCode] = key.split(":");
        if (!valueMap.has(rowCode)) valueMap.set(rowCode, new Map());
        const aggVal = aggregated.get(rowCode)?.get(colCode);
        const manualVal = cell.manual_override;
        // Use aggregated value if available, else keep existing auto_value
        valueMap.get(rowCode)!.set(colCode, aggVal !== undefined ? aggVal : (cell.auto_value || 0));
        // If there's a manual override, use that for summary computation
        if (manualVal !== null && manualVal !== undefined) {
          valueMap.get(rowCode)!.set(colCode, manualVal);
        }
      }

      // Rows where summaryOf means subtraction (first - rest)
      const subtractionRows = new Set(["4.1.3", "4.2.3", "10"]);

      // Compute summary rows in order (sections are ordered, so dependencies resolve naturally)
      for (const section of POPDV_SECTIONS) {
        for (const subTable of section.subTables) {
          for (const row of subTable.rows) {
            if (!row.isSummary || !row.summaryOf || row.summaryOf.length === 0) continue;

            const isSubtraction = subtractionRows.has(row.code);

            for (const col of row.columns) {
              let total = 0;
              if (isSubtraction) {
                // first element minus the rest
                const firstVal = valueMap.get(row.summaryOf[0])?.get(col.code) || 0;
                let rest = 0;
                for (let i = 1; i < row.summaryOf.length; i++) {
                  rest += valueMap.get(row.summaryOf[i])?.get(col.code) || 0;
                }
                total = firstVal - rest;
              } else {
                for (const srcCode of row.summaryOf) {
                  total += valueMap.get(srcCode)?.get(col.code) || 0;
                }
              }

              // Update value map so dependent summaries can use this
              if (!valueMap.has(row.code)) valueMap.set(row.code, new Map());
              valueMap.get(row.code)!.set(col.code, total);

              // Update the cell in DB
              const cell = cellMap.get(`${row.code}:${col.code}`);
              if (cell) {
                await supabase
                  .from("popdv_report_cells")
                  .update({ auto_value: total })
                  .eq("id", cell.id);
                updatedCount++;
              }
            }
          }
        }
      }

      cellsQuery.refetch();
      toast.success(`Podaci preuzeti iz analitike (${updatedCount} polja ažurirano)`);
    } catch (err) {
      toast.error("Greška pri preuzimanju podataka iz analitike");
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
            <Button variant="outline" size="sm" asChild>
              <Link to={`/racunovodstvo/popdv/${id}/analytical`}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Analitički obrazac
              </Link>
            </Button>
            {isDraft && (
              <>
                <Button variant="outline" size="sm" onClick={handleAutoPopulate} disabled={calculating}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${calculating ? "animate-spin" : ""}`} />
                  Preuzmi iz analitike
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
        <Tabs value={activeSection} onValueChange={handleSectionChange}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {POPDV_SECTIONS.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="text-xs">
                Deo {s.id}
              </TabsTrigger>
            ))}
          </TabsList>

          {POPDV_SECTIONS.map((section) => (
            <TabsContent key={section.id} value={section.id}>
              <div className="erp-card max-h-[calc(100vh-280px)] overflow-y-auto">
                <div className="p-4 border-b sticky top-0 bg-card z-10">
                  <h2 className="font-semibold">Deo {section.id}: {section.title}</h2>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </div>
                <div className="space-y-4">
                  {section.subTables.map((subTable) => (
                    <SubTableView
                      key={subTable.id}
                      subTable={subTable}
                      cellMap={cellMap}
                      getCellValue={getCellValue}
                      onCellChange={handleCellChange}
                      readonly={!isDraft}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </MainLayout>
  );
}

interface SubTableViewProps {
  subTable: PopdvSubTable;
  cellMap: Map<string, any>;
  getCellValue: (row: string, col: string) => number;
  onCellChange: (row: string, col: string, value: number | null) => void;
  readonly: boolean;
}

function SubTableView({ subTable, cellMap, getCellValue, onCellChange, readonly }: SubTableViewProps) {
  return (
    <div className="overflow-x-auto">
      {subTable.title && (
        <div className="px-4 py-2 bg-muted/30 border-b">
          <h3 className="text-sm font-medium">{subTable.title}</h3>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Šifra</TableHead>
            <TableHead className="min-w-[300px]">Opis</TableHead>
            {subTable.columns.map((col) => (
              <TableHead key={col.code} className="w-[160px] text-right">{col.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {subTable.rows.map((row) => (
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
                      {displayVal.toLocaleString("sr-RS", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </TableCell>
                  );
                }

                return (
                  <TableCell key={col.code} className="p-1">
                    <BlurCommitCell
                      value={displayVal}
                      autoVal={autoVal}
                      isOverridden={isOverridden}
                      onCommit={(num) => onCellChange(row.code, col.code, num === autoVal ? null : num)}
                    />
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

// ── Blur-commit cell for summary form ──

interface BlurCommitCellProps {
  value: number;
  autoVal: number;
  isOverridden: boolean;
  onCommit: (value: number) => void;
}

function BlurCommitCell({ value, autoVal, isOverridden, onCommit }: BlurCommitCellProps) {
  const [localVal, setLocalVal] = React.useState(String(value));
  const committedRef = React.useRef(value);

  React.useEffect(() => {
    // Sync from parent when value changes externally
    if (value !== committedRef.current) {
      setLocalVal(String(value));
      committedRef.current = value;
    }
  }, [value]);

  return (
    <div className="relative">
      <LocaleNumberInput
        value={localVal}
        onChange={(v) => setLocalVal(v)}
        onBlur={() => {
          const parsed = parseFloat(localVal.replace(/\./g, "").replace(",", ".")) || 0;
          committedRef.current = parsed;
          onCommit(parsed);
        }}
        decimalPlaces={2}
        className={`text-right h-8 ${isOverridden ? "border-primary bg-primary/5" : ""}`}
      />
      {isOverridden && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" title={`Auto: ${autoVal.toLocaleString("sr-RS", { minimumFractionDigits: 2 })}`} />
      )}
    </div>
  );
}
