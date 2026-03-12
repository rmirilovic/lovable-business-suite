import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { POPDV_SECTIONS } from "@/data/popdvFormStructure";
import type { PopdvDetailRow } from "@/hooks/usePopdvDetailRows";

const fmt2 = (v: number) =>
  v.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The row that was clicked */
  sourceRow: PopdvDetailRow | null;
  /** All detail rows for this report */
  allRows: PopdvDetailRow[];
}

export function PopdvDocumentReviewDialog({ open, onOpenChange, sourceRow, allRows }: Props) {
  // Find all rows that belong to the same document
  const matchingRows = useMemo(() => {
    if (!sourceRow) return [];
    // Match by source_document_id if available, otherwise by document_type_number
    const srcDocId = (sourceRow as any).source_document_id;
    const docNum = sourceRow.document_type_number;

    return allRows.filter((r) => {
      if (srcDocId) {
        return (r as any).source_document_id === srcDocId;
      }
      if (docNum) {
        return r.document_type_number === docNum;
      }
      return r.id === sourceRow.id;
    });
  }, [sourceRow, allRows]);

  // Build section/row lookup for labels
  const sectionMap = useMemo(() => {
    const map = new Map<string, { title: string; rowLabel: string }>();
    for (const section of POPDV_SECTIONS) {
      for (const st of section.subTables) {
        // Use subTable id as key (e.g. "8a") since detail rows store subTable id in section field
        const sectionKey = st.id || section.id;
        const title = st.title || section.title;
        for (const row of st.rows) {
          map.set(`${sectionKey}|${row.code}`, {
            title,
            rowLabel: row.label,
          });
        }
      }
    }
    return map;
  }, []);

  // Determine which value columns have non-zero data across all matching rows
  const activeColumns = useMemo(() => {
    const colSet = new Set<string>();
    for (const row of matchingRows) {
      for (const [key, val] of Object.entries(row.values)) {
        if (val !== 0) colSet.add(key);
      }
    }
    // Build ordered column list with labels from POPDV structure
    const colLabelMap = new Map<string, string>();
    for (const section of POPDV_SECTIONS) {
      for (const st of section.subTables) {
        for (const col of st.columns) {
          if (!colLabelMap.has(col.code)) {
            colLabelMap.set(col.code, col.label);
          }
        }
      }
    }
    return Array.from(colSet).map((code) => ({
      code,
      label: colLabelMap.get(code) || code,
    }));
  }, [matchingRows]);

  // Compute totals
  const totals = useMemo(() => {
    const sums: Record<string, number> = {};
    for (const col of activeColumns) sums[col.code] = 0;
    for (const row of matchingRows) {
      for (const col of activeColumns) {
        sums[col.code] += row.values[col.code] || 0;
      }
    }
    return sums;
  }, [matchingRows, activeColumns]);

  if (!sourceRow) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Pregled po dokumentu</DialogTitle>
          <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
            <div><span className="font-medium">Datum:</span> {sourceRow.document_date || "—"}</div>
            <div><span className="font-medium">Dokument:</span> {sourceRow.document_type_number || "—"}</div>
            <div><span className="font-medium">Partner:</span> {sourceRow.partner_info || "—"}</div>
          </div>
        </DialogHeader>

        <div className="overflow-auto flex-1 -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Deo</TableHead>
                <TableHead className="min-w-[200px]">Opis dela</TableHead>
                <TableHead className="w-[80px]">Šifra</TableHead>
                {activeColumns.map((col) => (
                  <TableHead key={col.code} className="w-[140px] text-right">{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchingRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3 + activeColumns.length} className="text-center text-muted-foreground py-8">
                    Nema podataka
                  </TableCell>
                </TableRow>
              ) : (
                matchingRows.map((row) => {
                  const info = sectionMap.get(`${row.section}|${row.row_code}`);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.section}</TableCell>
                      <TableCell className="text-xs truncate max-w-[300px]" title={info?.title}>
                        {info?.title ? (info.title.length > 80 ? info.title.substring(0, 80) + "..." : info.title) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.row_code}</TableCell>
                      {activeColumns.map((col) => (
                        <TableCell key={col.code} className="text-right font-mono tabular-nums text-xs">
                          {fmt2(row.values[col.code] || 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
              {matchingRows.length > 0 && (
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell colSpan={3} className="text-xs text-right pr-2">Ukupno:</TableCell>
                  {activeColumns.map((col) => (
                    <TableCell key={col.code} className="text-right font-mono tabular-nums text-xs font-semibold">
                      {fmt2(totals[col.code] || 0)}
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
