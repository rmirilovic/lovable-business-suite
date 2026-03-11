import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { POPDV_SECTIONS } from "@/data/popdvFormStructure";

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

// Build map: row_code -> section label (e.g. "8a", "3", "6")
function buildSectionMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of POPDV_SECTIONS) {
    for (const st of section.subTables) {
      for (const row of st.rows) {
        if (!row.isSummary) {
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
  
  values: Record<string, number>;
  [key: string]: any; // for dynamic value column access in sorting
}

export default function PopdvDocumentsReport() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;

  // Fetch company vat_period_type for default dates
  const companyQuery = useQuery({
    queryKey: ["company_vat_period", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase
        .from("companies")
        .select("vat_period_type")
        .eq("id", companyId)
        .single();
      return data;
    },
    enabled: !!companyId,
  });

  const defaultPeriod = useMemo(() => {
    const now = new Date();
    const isQuarterly = companyQuery.data?.vat_period_type === "quarterly";
    if (isQuarterly) {
      return { start: format(startOfQuarter(now), "yyyy-MM-dd"), end: format(endOfQuarter(now), "yyyy-MM-dd") };
    }
    return { start: format(startOfMonth(now), "yyyy-MM-dd"), end: format(endOfMonth(now), "yyyy-MM-dd") };
  }, [companyQuery.data]);

  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Use default period once loaded
  const effectiveDateFrom = dateFrom || defaultPeriod.start;
  const effectiveDateTo = dateTo || defaultPeriod.end;

  const [searchTerm, setSearchTerm] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterRowCode, setFilterRowCode] = useState("");

  const dataQuery = useQuery({
    queryKey: ["popdv_documents_report", companyId, effectiveDateFrom, effectiveDateTo],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("popdv_report_detail_rows")
        .select("id, document_date, section, row_code, document_type_number, partner_info, values")
        .eq("company_id", companyId)
        .gte("document_date", effectiveDateFrom)
        .lte("document_date", effectiveDateTo)
        .order("document_date")
        .order("row_code");
      if (error) throw error;
      return (data as any[]).map((r): FlatRow => {
        const vals = r.values || {};
        const flat: FlatRow = {
          id: r.id,
          document_date: r.document_date,
          section_label: sectionMap.get(r.row_code) || r.section,
          row_code: r.row_code,
          document_type_number: r.document_type_number,
          partner_info: r.partner_info,
          
          values: vals,
        };
        // Flatten value columns for sorting
        for (const col of ALL_VALUE_COLUMNS) {
          flat[col.code] = vals[col.code] || 0;
        }
        return flat;
      });
    },
    enabled: !!companyId && !!effectiveDateFrom && !!effectiveDateTo,
  });

  const rows = dataQuery.data || [];

  const filtered = useMemo(() => {
    let result = rows;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          (r.document_type_number || "").toLowerCase().includes(term) ||
          (r.partner_info || "").toLowerCase().includes(term) ||
          
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

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("document_date", "asc");

  const sortedData = useMemo(
    () => sortItems(filtered, (item, col) => item[col]),
    [filtered, sortItems]
  );

  const uniqueSections = useMemo(() => [...new Set(rows.map((r) => r.section_label))].sort(), [rows]);
  const uniqueRowCodes = useMemo(() => [...new Set(rows.map((r) => r.row_code))].sort(), [rows]);

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
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/racunovodstvo/popdv")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">POPDV — Pregled uknjiženih dokumenata</h1>
            <p className="text-sm text-muted-foreground">Svi dokumenti uknjiženi u POPDV za izabrani period</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Datum od</label>
            <LocaleDateInput value={effectiveDateFrom} onChange={setDateFrom} className="w-[150px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Datum do</label>
            <LocaleDateInput value={effectiveDateTo} onChange={setDateTo} className="w-[150px]" />
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

        <div className="erp-card overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-[90px]">
                  <SortableHeader column="document_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[60px]">
                  <SortableHeader column="section_label" label="Deo" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[70px]">
                  <SortableHeader column="row_code" label="Tačka" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[160px]">
                  <SortableHeader column="document_type_number" label="Interni dokument" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[200px]">
                  <SortableHeader column="partner_info" label="Partner" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                {ALL_VALUE_COLUMNS.map((col) => (
                  <TableHead key={col.code} className="w-[120px]">
                    <SortableHeader
                      column={col.code}
                      label={col.label}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                      className="justify-end"
                    />
                  </TableHead>
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
