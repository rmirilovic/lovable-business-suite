import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { ArrowLeft, Search, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { POPDV_SECTIONS } from "@/data/popdvFormStructure";

// All unique value column codes from the POPDV form
const ALL_VALUE_COLUMNS = [
  { code: "opsta_osnov", label: "Opšta - Osnovica" },
  { code: "opsta_pdv", label: "Opšta - PDV" },
  { code: "posebna_osnov", label: "Posebna - Osnovica" },
  { code: "posebna_pdv", label: "Posebna - PDV" },
  { code: "iznos", label: "Iznos" },
  { code: "osnov", label: "Osnov" },
  { code: "pdv", label: "PDV" },
  { code: "vrednost", label: "Vrednost" },
  { code: "pdv_naknada", label: "PDV nadoknada" },
];

const fmt2 = (v: number) =>
  v.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getDefaultPeriod(vatPeriodType: string | undefined): { start: string; end: string } {
  const now = new Date();
  if (vatPeriodType === "quarterly") {
    const qs = startOfQuarter(now);
    const qe = endOfQuarter(now);
    return { start: format(qs, "yyyy-MM-dd"), end: format(qe, "yyyy-MM-dd") };
  }
  const ms = startOfMonth(now);
  const me = endOfMonth(now);
  return { start: format(ms, "yyyy-MM-dd"), end: format(me, "yyyy-MM-dd") };
}

// Build a map: row_code -> section label (e.g. "8v")
function buildSectionMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of POPDV_SECTIONS) {
    for (const st of section.subTables) {
      for (const row of st.rows) {
        if (!row.isSummary) {
          // Find the sub-table prefix: e.g. for "8a.2" the section is "8a"
          const dotIdx = row.code.indexOf(".");
          const sectionCode = dotIdx > 0 ? row.code.substring(0, dotIdx) : section.id;
          map.set(row.code, sectionCode);
        }
      }
    }
  }
  return map;
}

const sectionMap = buildSectionMap();

interface FlatRow {
  id: string;
  document_date: string | null;
  section_label: string;
  row_code: string;
  document_type_number: string | null;
  partner_info: string | null;
  supplier_document_number: string | null;
  values: Record<string, number>;
  // Flatten value columns for sorting
  opsta_osnov: number;
  opsta_pdv: number;
  posebna_osnov: number;
  posebna_pdv: number;
  iznos: number;
  osnov: number;
  pdv: number;
  vrednost: number;
  pdv_naknada: number;
}

export default function PopdvDocumentsReport() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;
  const vatPeriodType = selectedCompany?.vat_period_type;

  const defaultPeriod = useMemo(() => getDefaultPeriod(vatPeriodType), [vatPeriodType]);
  const [dateFrom, setDateFrom] = useState(defaultPeriod.start);
  const [dateTo, setDateTo] = useState(defaultPeriod.end);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterRowCode, setFilterRowCode] = useState("");

  const dataQuery = useQuery({
    queryKey: ["popdv_documents_report", companyId, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("popdv_report_detail_rows")
        .select("id, document_date, section, row_code, document_type_number, partner_info, supplier_document_number, values")
        .eq("company_id", companyId)
        .gte("document_date", dateFrom)
        .lte("document_date", dateTo)
        .order("document_date")
        .order("row_code");
      if (error) throw error;
      return (data as any[]).map((r): FlatRow => {
        const vals = r.values || {};
        return {
          id: r.id,
          document_date: r.document_date,
          section_label: sectionMap.get(r.row_code) || r.section,
          row_code: r.row_code,
          document_type_number: r.document_type_number,
          partner_info: r.partner_info,
          supplier_document_number: r.supplier_document_number,
          values: vals,
          opsta_osnov: vals.opsta_osnov || 0,
          opsta_pdv: vals.opsta_pdv || 0,
          posebna_osnov: vals.posebna_osnov || 0,
          posebna_pdv: vals.posebna_pdv || 0,
          iznos: vals.iznos || 0,
          osnov: vals.osnov || 0,
          pdv: vals.pdv || 0,
          vrednost: vals.vrednost || 0,
          pdv_naknada: vals.pdv_naknada || 0,
        };
      });
    },
    enabled: !!companyId && !!dateFrom && !!dateTo,
  });

  const rows = dataQuery.data || [];

  // Apply text filters
  const filtered = useMemo(() => {
    let result = rows;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          (r.document_type_number || "").toLowerCase().includes(term) ||
          (r.partner_info || "").toLowerCase().includes(term) ||
          (r.supplier_document_number || "").toLowerCase().includes(term) ||
          r.row_code.toLowerCase().includes(term) ||
          r.section_label.toLowerCase().includes(term)
      );
    }
    if (filterSection) {
      result = result.filter((r) => r.section_label === filterSection);
    }
    if (filterRowCode) {
      result = result.filter((r) => r.row_code === filterRowCode);
    }
    return result;
  }, [rows, searchTerm, filterSection, filterRowCode]);

  // Sorting
  const { sortedData, sortColumn, sortDirection, handleSort } = useTableSort<FlatRow>(
    filtered,
    "document_date",
    "asc"
  );

  // Unique sections and row codes for filters
  const uniqueSections = useMemo(() => [...new Set(rows.map((r) => r.section_label))].sort(), [rows]);
  const uniqueRowCodes = useMemo(() => [...new Set(rows.map((r) => r.row_code))].sort(), [rows]);

  // Totals
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const col of ALL_VALUE_COLUMNS) {
      t[col.code] = sortedData.reduce((sum, r) => sum + (r.values[col.code] || 0), 0);
    }
    return t;
  }, [sortedData]);

  return (
    <MainLayout title="POPDV — Pregled uknjiženih dokumenata">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/racunovodstvo/popdv")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">POPDV — Pregled uknjiženih dokumenata</h1>
            <p className="text-sm text-muted-foreground">Svi dokumenti uknjiženi u POPDV za izabrani period</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Datum od</label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Datum do</label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Pretraga</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Dokument, partner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Deo</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
            >
              <option value="">Svi</option>
              {uniqueSections.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tačka</label>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={filterRowCode}
              onChange={(e) => setFilterRowCode(e.target.value)}
            >
              <option value="">Sve</option>
              {uniqueRowCodes.map((rc) => (
                <option key={rc} value={rc}>{rc}</option>
              ))}
            </select>
          </div>
          <div className="text-sm text-muted-foreground self-end pb-2">
            {sortedData.length} dokumenata
          </div>
        </div>

        {/* Table */}
        <div className="erp-card overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <SortableHeader column="document_date" label="Datum" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} className="w-[90px]" />
                <SortableHeader column="section_label" label="Deo" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} className="w-[60px]" />
                <SortableHeader column="row_code" label="Tačka" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} className="w-[70px]" />
                <SortableHeader column="document_type_number" label="Interni dokument" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} className="w-[160px]" />
                <SortableHeader column="partner_info" label="Partner" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} className="min-w-[200px]" />
                <SortableHeader column="supplier_document_number" label="Dokument partnera" currentSort={sortColumn} direction={sortDirection} onSort={handleSort} className="w-[140px]" />
                {ALL_VALUE_COLUMNS.map((col) => (
                  <SortableHeader
                    key={col.code}
                    column={col.code}
                    label={col.label}
                    currentSort={sortColumn}
                    direction={sortDirection}
                    onSort={handleSort}
                    className="w-[120px] text-right"
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6 + ALL_VALUE_COLUMNS.length} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6 + ALL_VALUE_COLUMNS.length} className="text-center py-8 text-muted-foreground">
                    Nema uknjiženih dokumenata za izabrani period
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {sortedData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs font-mono">
                        {row.document_date ? format(parseISO(row.document_date), "dd.MM.yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-medium">{row.section_label}</TableCell>
                      <TableCell className="text-xs font-mono">{row.row_code}</TableCell>
                      <TableCell className="text-xs">{row.document_type_number || "—"}</TableCell>
                      <TableCell className="text-xs truncate max-w-[250px]">{row.partner_info || "—"}</TableCell>
                      <TableCell className="text-xs">{row.supplier_document_number || "—"}</TableCell>
                      {ALL_VALUE_COLUMNS.map((col) => {
                        const val = row.values[col.code] || 0;
                        return (
                          <TableCell key={col.code} className="text-right font-mono tabular-nums text-xs">
                            {val !== 0 ? fmt2(val) : ""}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-semibold border-t-2 sticky bottom-0">
                    <TableCell colSpan={6} className="text-xs text-right pr-4">Ukupno:</TableCell>
                    {ALL_VALUE_COLUMNS.map((col) => (
                      <TableCell key={col.code} className="text-right font-mono tabular-nums text-xs font-semibold">
                        {totals[col.code] !== 0 ? fmt2(totals[col.code]) : ""}
                      </TableCell>
                    ))}
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
