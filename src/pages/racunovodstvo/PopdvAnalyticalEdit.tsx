import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { usePopdvReportDetail } from "@/hooks/usePopdvReports";
import { usePopdvDetailRows, PopdvDetailRow } from "@/hooks/usePopdvDetailRows";
import { POPDV_SECTIONS, PopdvSubTable, PopdvColumn } from "@/data/popdvFormStructure";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, FileText, MoreHorizontal } from "lucide-react";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PopdvDocumentReviewDialog } from "@/components/racunovodstvo/PopdvDocumentReviewDialog";

const fmt2 = (v: number) =>
  v.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmt0 = (v: number) =>
  v.toLocaleString("sr-RS", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function PopdvAnalyticalEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reportQuery = usePopdvReportDetail(id);
  const { detailRowsQuery, addRow, updateRow, deleteRow } = usePopdvDetailRows(id);

  const [activeSection, setActiveSection] = useState(() =>
    sessionStorage.getItem(`popdv_analytical_section_${id}`) || "1"
  );
  const handleSectionChange = useCallback(
    (value: string) => {
      setActiveSection(value);
      sessionStorage.setItem(`popdv_analytical_section_${id}`, value);
    },
    [id]
  );

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSectionId, setAddSectionId] = useState("");
  const [addRowCode, setAddRowCode] = useState("");
  const [reviewRow, setReviewRow] = useState<PopdvDetailRow | null>(null);

  const report = reportQuery.data;
  const detailRows = detailRowsQuery.data || [];
  const isDraft = report?.status === "draft";

  // Group detail rows by row_code
  const rowsByCode = useMemo(() => {
    const map = new Map<string, PopdvDetailRow[]>();
    for (const row of detailRows) {
      if (!map.has(row.row_code)) map.set(row.row_code, []);
      map.get(row.row_code)!.push(row);
    }
    return map;
  }, [detailRows]);

  // Allowed row codes (non-summary) for a given section
  const getAllowedRowCodes = useCallback((sectionId: string) => {
    const section = POPDV_SECTIONS.find((s) => s.id === sectionId);
    if (!section) return [];
    const codes: { code: string; label: string }[] = [];
    for (const st of section.subTables) {
      for (const row of st.rows) {
        if (!row.isSummary) {
          codes.push({ code: row.code, label: row.label });
        }
      }
    }
    return codes;
  }, []);

  const handleAddRow = () => {
    if (!addRowCode || !addSectionId) return;
    addRow.mutate(
      { section: addSectionId, row_code: addRowCode },
      { onSuccess: () => { setShowAddDialog(false); setAddRowCode(""); } }
    );
  };

  const handleUpdateField = useCallback(
    (rowId: string, field: "document_date" | "document_type_number" | "partner_info", value: string) => {
      updateRow.mutate({ id: rowId, [field]: value || null });
    },
    [updateRow]
  );

  const handleUpdateValue = useCallback(
    (row: PopdvDetailRow, colCode: string, value: number) => {
      updateRow.mutate({ id: row.id, values: { ...row.values, [colCode]: value } });
    },
    [updateRow]
  );

  if (reportQuery.isLoading || detailRowsQuery.isLoading) {
    return (
      <MainLayout title="POPDV Analitički">
        <div className="p-8 text-center text-muted-foreground">Učitavanje...</div>
      </MainLayout>
    );
  }
  if (!report) {
    return (
      <MainLayout title="POPDV Analitički">
        <div className="p-8 text-center text-muted-foreground">Izveštaj nije pronađen</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={`POPDV Analitički — ${report.period_label}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/racunovodstvo/popdv")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">POPDV Analitički — {report.period_label}</h1>
              <p className="text-sm text-muted-foreground">
                {report.period_start} — {report.period_end} · Detalji po dokumentima
              </p>
            </div>
            <span className={report.status === "finalized" ? "erp-badge-success" : "erp-badge-warning"}>
              {report.status === "finalized" ? "Zaključen" : "Nacrt"}
            </span>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/racunovodstvo/popdv/${id}`}>
              <FileText className="w-4 h-4 mr-2" />
              Sumarni obrazac
            </Link>
          </Button>
        </div>

        {/* Tabs */}
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
                <div className="p-4 border-b sticky top-0 bg-card z-10 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Deo {section.id}: {section.title}</h2>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                  {isDraft && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAddSectionId(section.id);
                        const codes = getAllowedRowCodes(section.id);
                        setAddRowCode(codes.length > 0 ? codes[0].code : "");
                        setShowAddDialog(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Dodaj red
                    </Button>
                  )}
                </div>
                <div className="space-y-6 p-2">
                  {section.subTables.map((subTable) => (
                    <AnalyticalSubTable
                      key={subTable.id}
                      subTable={subTable}
                      rowsByCode={rowsByCode}
                      isDraft={isDraft}
                      onUpdateField={handleUpdateField}
                      onUpdateValue={handleUpdateValue}
                      onDeleteRow={(rowId) => {
                        if (confirm("Obrisati ovaj red?")) deleteRow.mutate(rowId);
                      }}
                      onReviewDocument={setReviewRow}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Add Row Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dodaj novi red u deo {addSectionId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tačka (šifra)</Label>
              <Select value={addRowCode} onValueChange={setAddRowCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberi tačku" />
                </SelectTrigger>
                <SelectContent>
                  {getAllowedRowCodes(addSectionId).map((rc) => (
                    <SelectItem key={rc.code} value={rc.code}>
                      {rc.code} — {rc.label.length > 70 ? rc.label.substring(0, 70) + "..." : rc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Otkaži</Button>
            <Button onClick={handleAddRow} disabled={!addRowCode || addRow.isPending}>
              {addRow.isPending ? "Dodavanje..." : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Review Dialog */}
      <PopdvDocumentReviewDialog
        open={!!reviewRow}
        onOpenChange={(open) => { if (!open) setReviewRow(null); }}
        sourceRow={reviewRow}
        allRows={detailRows}
      />
    </MainLayout>
  );
}

// ── Analytical Sub-Table ──

interface AnalyticalSubTableProps {
  subTable: PopdvSubTable;
  rowsByCode: Map<string, PopdvDetailRow[]>;
  isDraft: boolean;
  onUpdateField: (rowId: string, field: "document_date" | "document_type_number" | "partner_info", value: string) => void;
  onUpdateValue: (row: PopdvDetailRow, colCode: string, value: number) => void;
  onDeleteRow: (rowId: string) => void;
  onReviewDocument: (row: PopdvDetailRow) => void;
}

function AnalyticalSubTable({
  subTable,
  rowsByCode,
  isDraft,
  onUpdateField,
  onUpdateValue,
  onDeleteRow,
  onReviewDocument,
}: AnalyticalSubTableProps) {
  const cols = subTable.columns;

  // Compute subtotal for a row_code across all its detail rows
  const subtotal = useCallback(
    (rowCode: string, colCode: string) => {
      return (rowsByCode.get(rowCode) || []).reduce(
        (sum, r) => sum + (r.values[colCode] || 0),
        0
      );
    },
    [rowsByCode]
  );

  // Compute summary across multiple row codes (for isSummary rows)
  const summaryTotal = useCallback(
    (summaryOf: string[] | undefined, colCode: string) => {
      if (!summaryOf) return 0;
      return summaryOf.reduce((sum, code) => sum + subtotal(code, colCode), 0);
    },
    [subtotal]
  );

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
              <TableHead className="w-[70px]">Šifra</TableHead>
              <TableHead className="w-[100px]">Datum</TableHead>
              <TableHead className="w-[140px]">Dokument</TableHead>
              <TableHead className="min-w-[180px]">Partner</TableHead>
              {cols.map((col) => (
                <TableHead key={col.code} className="w-[130px] text-right">
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="w-[40px]" />
            </TableRow>
        </TableHeader>
        <TableBody>
          {subTable.rows.map((formRow) => {
            if (formRow.isSummary) {
              return (
                <TableRow key={formRow.code} className="bg-muted/50 font-semibold border-t-2">
                  <TableCell className="font-mono text-xs">{formRow.code}</TableCell>
                  <TableCell colSpan={3} className="text-xs">
                    {formRow.label}
                  </TableCell>
                  {cols.map((col) => (
                    <TableCell key={col.code} className="text-right font-mono tabular-nums text-xs">
                      {fmt0(summaryTotal(formRow.summaryOf, col.code))}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              );
            }

            const details = rowsByCode.get(formRow.code) || [];

            if (details.length === 0) {
              // Empty placeholder row
              return (
                <TableRow key={formRow.code} className="text-muted-foreground">
                  <TableCell className="font-mono text-xs">{formRow.code}</TableCell>
                  <TableCell colSpan={3} className="text-xs italic truncate max-w-[300px]">
                    {formRow.label}
                  </TableCell>
                  {cols.map((col) => (
                    <TableCell key={col.code} className="text-right font-mono tabular-nums text-xs">
                      {fmt2(0)}
                    </TableCell>
                  ))}
                  <TableCell />
                </TableRow>
              );
            }

            return (
              <RowCodeBlock
                key={formRow.code}
                code={formRow.code}
                details={details}
                cols={cols}
                isDraft={isDraft}
                subtotal={subtotal}
                onUpdateField={onUpdateField}
                onUpdateValue={onUpdateValue}
                onDeleteRow={onDeleteRow}
                onReviewDocument={onReviewDocument}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Block of detail rows + subtotal for one row_code ──

interface RowCodeBlockProps {
  code: string;
  details: PopdvDetailRow[];
  cols: PopdvColumn[];
  isDraft: boolean;
  subtotal: (rowCode: string, colCode: string) => number;
  onUpdateField: (rowId: string, field: "document_date" | "document_type_number" | "partner_info", value: string) => void;
  onUpdateValue: (row: PopdvDetailRow, colCode: string, value: number) => void;
  onDeleteRow: (rowId: string) => void;
  onReviewDocument: (row: PopdvDetailRow) => void;
}

function RowCodeBlock({
  code,
  details,
  cols,
  isDraft,
  subtotal,
  onUpdateField,
  onUpdateValue,
  onDeleteRow,
  onReviewDocument,
}: RowCodeBlockProps) {
  return (
    <>
      {details.map((dr, idx) => (
        <TableRow key={dr.id} className="border-b-0">
          <TableCell className="font-mono text-xs">
            {idx === 0 ? code : ""}
          </TableCell>
          <TableCell className="p-1">
            {isDraft ? (
              <LocaleDateInput
                value={dr.document_date || ""}
                onChange={(v) => onUpdateField(dr.id, "document_date", v)}
                className="w-[160px]"
              />
            ) : (
              <span className="text-xs">{dr.document_date ? format(parseISO(dr.document_date), "dd.MM.yyyy") : "—"}</span>
            )}
          </TableCell>
          <TableCell className="p-1">
            {isDraft ? (
              <Input
                className="h-7 text-xs"
                defaultValue={dr.document_type_number || ""}
                placeholder="UFU: 260001"
                onBlur={(e) => onUpdateField(dr.id, "document_type_number", e.target.value)}
              />
            ) : (
              <span className="text-xs">{dr.document_type_number || "—"}</span>
            )}
          </TableCell>
          <TableCell className="p-1">
            {isDraft ? (
              <Input
                className="h-7 text-xs"
                defaultValue={dr.partner_info || ""}
                placeholder="Šifra - Naziv"
                onBlur={(e) => onUpdateField(dr.id, "partner_info", e.target.value)}
              />
            ) : (
              <span className="text-xs">{dr.partner_info || "—"}</span>
            )}
          </TableCell>
          {cols.map((col) => {
            const val = dr.values[col.code] || 0;
            if (!isDraft) {
              return (
                <TableCell key={col.code} className="text-right font-mono tabular-nums text-xs">
                  {fmt2(val)}
                </TableCell>
              );
            }
            return (
              <TableCell key={col.code} className="p-1">
                <AnalyticalBlurCell
                  value={val}
                  onCommit={(num) => onUpdateValue(dr, col.code, num)}
                />
              </TableCell>
            );
          })}
          <TableCell className="p-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onReviewDocument(dr)}>
                  Pregled po dokumentu
                </DropdownMenuItem>
                {isDraft && (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDeleteRow(dr.id)}
                  >
                    Obriši
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      ))}
      {/* Subtotal */}
      <TableRow className="bg-muted/20 border-b-2">
        <TableCell className="font-mono text-xs font-medium">{code}</TableCell>
        <TableCell colSpan={3} className="text-xs font-medium text-right pr-2">
          Ukupno:
        </TableCell>
        {cols.map((col) => (
          <TableCell key={col.code} className="text-right font-mono tabular-nums text-xs font-semibold">
            {fmt2(subtotal(code, col.code))}
          </TableCell>
        ))}
        {isDraft && <TableCell />}
      </TableRow>
    </>
  );
}

// ── Blur-commit cell for analytical form ──

interface AnalyticalBlurCellProps {
  value: number;
  onCommit: (value: number) => void;
}

function AnalyticalBlurCell({ value, onCommit }: AnalyticalBlurCellProps) {
  const [localVal, setLocalVal] = React.useState(String(value));
  const committedRef = React.useRef(value);

  React.useEffect(() => {
    if (value !== committedRef.current) {
      setLocalVal(String(value));
      committedRef.current = value;
    }
  }, [value]);

  return (
    <LocaleNumberInput
      value={localVal}
      onChange={(v) => setLocalVal(v)}
      onBlur={() => {
        const parsed = parseFloat(localVal.replace(/\./g, "").replace(",", ".")) || 0;
        committedRef.current = parsed;
        onCommit(parsed);
      }}
      decimalPlaces={2}
      className="text-right h-7 text-xs"
    />
  );
}
