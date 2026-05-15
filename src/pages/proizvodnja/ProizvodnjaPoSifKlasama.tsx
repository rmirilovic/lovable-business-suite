import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfYear } from "date-fns";
import { formatDecimal } from "@/lib/formatting";
import {
  exportProizvodnjaPoSifKlasamaToExcel,
  exportProizvodnjaPoSifKlasamaToPdf,
  printProizvodnjaPoSifKlasama,
  ReportSection,
  SectionLine,
  SectionMainClass,
  SectionSubclass,
  SectionArticleRow,
} from "@/lib/proizvodnjaPoSifKlasamaExportUtils";

const PRODUCTION_TYPES_ORDER = ["PVC", "PE", "PP-KK", "PP-UK", "Varioci", "Održavanje", "Fazonski"];

const fmtQty = (v: number) => (v ? formatDecimal(v, 0) : "-");

export default function ProizvodnjaPoSifKlasama() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;
  const businessYearId = selectedYear?.id;

  const yearStart = selectedYear
    ? format(startOfYear(new Date(selectedYear.year, 0, 1)), "yyyy-MM-dd")
    : format(startOfYear(new Date()), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(yearStart);
  const [dateTo, setDateTo] = useState(today);
  const [classFilter, setClassFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["proizvodnja-po-sif-klasama", companyId, businessYearId, dateFrom, dateTo],
    enabled: !!companyId && !!businessYearId,
    queryFn: async () => {
      // 1. Notes in period
      const { data: notes, error: notesErr } = await supabase
        .from("production_delivery_notes")
        .select("id, delivery_date, production_line")
        .eq("company_id", companyId!)
        .eq("business_year_id", businessYearId!)
        .gte("delivery_date", dateFrom)
        .lte("delivery_date", dateTo);
      if (notesErr) throw notesErr;

      // 2. Items
      const noteIds = (notes || []).map((n) => n.id);
      const itemsRes = noteIds.length
        ? await (supabase as any)
            .from("production_delivery_note_items")
            .select("delivery_note_id, article_id, article_code, article_name, kg_per_unit, qty_total")
            .in("delivery_note_id", noteIds)
        : { data: [] as any[], error: null };
      if (itemsRes.error) throw itemsRes.error;
      const items = itemsRes.data as any[];

      const articleIds = Array.from(new Set(items.map((i) => i.article_id))) as string[];

      // 3. Articles, classifications, lines (parallel)
      const [{ data: articles }, { data: classifications }, { data: lines }] = await Promise.all([
        articleIds.length
          ? supabase.from("articles").select("id, article_group, kg_po_jm").in("id", articleIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("article_classifications").select("code, name, parent_code").eq("company_id", companyId!),
        supabase.from("production_lines" as any).select("code, name, production_type, is_active").eq("company_id", companyId!),
      ]);

      return {
        notes: notes || [],
        items,
        articles: (articles || []) as any[],
        classifications: (classifications || []) as any[],
        lines: (lines || []) as any[],
      };
    },
  });

  const mainClassOptions = useMemo(() => {
    const list = (data?.classifications || [])
      .filter((c: any) => /^[0-9]{2}$/.test(c.code))
      .sort((a: any, b: any) => a.code.localeCompare(b.code));
    return list as { code: string; name: string }[];
  }, [data?.classifications]);

  const sections: ReportSection[] = useMemo(() => {
    if (!data) return [];
    const { notes, items, articles, classifications, lines } = data;

    const noteMap = new Map<string, any>(notes.map((n: any) => [n.id, n]));
    const articleMap = new Map<string, any>(articles.map((a: any) => [a.id, a]));
    const classMap = new Map<string, { code: string; name: string; parent: string | null }>(
      classifications.map((c: any) => [c.code, { code: c.code, name: c.name, parent: c.parent_code }])
    );

    const mainCodeFor = (groupCode: string | null): string | null => {
      if (!groupCode) return null;
      let cur: string | null = groupCode;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        if (/^[0-9]{2}$/.test(cur)) return cur;
        const node = classMap.get(cur);
        if (!node) return null;
        cur = node.parent;
      }
      return null;
    };
    const subCodeFor = (groupCode: string | null, mainCode: string): string | null => {
      const targetLen = mainCode === "01" || mainCode === "02" ? 4 : 3;
      if (!groupCode) return null;
      let cur: string | null = groupCode;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        if (cur.length === targetLen) return cur;
        const node = classMap.get(cur);
        if (!node) return null;
        cur = node.parent;
      }
      return null;
    };
    const className = (code: string) => classMap.get(code)?.name ?? "";

    // production_line code -> production_type (from lines)
    const lineByCode = new Map<number, any>();
    lines.forEach((l: any) => lineByCode.set(Number(l.code), l));

    // Build per-type aggregation
    const result: ReportSection[] = [];

    PRODUCTION_TYPES_ORDER.forEach((ptype) => {
      // Determine which lines go in this section: active lines of type + lines that had production
      const activeOfType = lines.filter((l: any) => l.production_type === ptype && l.is_active);
      const usedLineCodes = new Set<number>();
      // collect lines with production in this type
      items.forEach((it: any) => {
        const note = noteMap.get(it.delivery_note_id);
        if (!note) return;
        const lineCode = Number(note.production_line);
        const lineMeta = lineByCode.get(lineCode);
        if (lineMeta && lineMeta.production_type === ptype) {
          usedLineCodes.add(lineCode);
        }
      });
      const lineCodesSet = new Set<number>(activeOfType.map((l: any) => Number(l.code)));
      usedLineCodes.forEach((c) => lineCodesSet.add(c));
      const sectionLines: SectionLine[] = Array.from(lineCodesSet)
        .sort((a, b) => a - b)
        .map((code) => ({ code, label: `L-${code}` }));

      if (sectionLines.length === 0) return; // skip empty section

      // Aggregate: main -> sub -> article
      type ArticleAgg = { code: string; name: string; qty: Record<number, number>; total: number };
      type SubAgg = { code: string; name: string; articles: Map<string, ArticleAgg>; totals: Record<number, number>; total: number };
      type MainAgg = { code: string; name: string; subs: Map<string, SubAgg>; totals: Record<number, number>; total: number };
      const mains = new Map<string, MainAgg>();
      const sectionTotals: Record<number, number> = {};
      let sectionTotal = 0;

      items.forEach((it: any) => {
        const note = noteMap.get(it.delivery_note_id);
        if (!note) return;
        const lineCode = Number(note.production_line);
        const lineMeta = lineByCode.get(lineCode);
        if (!lineMeta || lineMeta.production_type !== ptype) return;

        const article = articleMap.get(it.article_id);
        const groupCode = article?.article_group ?? null;
        const main = mainCodeFor(groupCode);
        if (!main) return;
        if (classFilter !== "all" && main !== classFilter) return;
        const sub = subCodeFor(groupCode, main) ?? main;

        const kgPerUnit = Number(article?.kg_po_jm ?? it.kg_per_unit ?? 0);
        const qty = Number(it.qty_total ?? 0);
        const kg = qty * kgPerUnit;
        if (!kg) return;

        let mainAgg = mains.get(main);
        if (!mainAgg) {
          mainAgg = { code: main, name: className(main), subs: new Map(), totals: {}, total: 0 };
          mains.set(main, mainAgg);
        }
        let subAgg = mainAgg.subs.get(sub);
        if (!subAgg) {
          subAgg = { code: sub, name: className(sub), articles: new Map(), totals: {}, total: 0 };
          mainAgg.subs.set(sub, subAgg);
        }
        let artAgg = subAgg.articles.get(it.article_id);
        if (!artAgg) {
          artAgg = { code: it.article_code, name: it.article_name, qty: {}, total: 0 };
          subAgg.articles.set(it.article_id, artAgg);
        }
        artAgg.qty[lineCode] = (artAgg.qty[lineCode] || 0) + kg;
        artAgg.total += kg;
        subAgg.totals[lineCode] = (subAgg.totals[lineCode] || 0) + kg;
        subAgg.total += kg;
        mainAgg.totals[lineCode] = (mainAgg.totals[lineCode] || 0) + kg;
        mainAgg.total += kg;
        sectionTotals[lineCode] = (sectionTotals[lineCode] || 0) + kg;
        sectionTotal += kg;
      });

      const mainList: SectionMainClass[] = Array.from(mains.values())
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((m) => {
          const subs: SectionSubclass[] = Array.from(m.subs.values())
            .sort((a, b) => a.code.localeCompare(b.code))
            .map((s) => {
              const articles: SectionArticleRow[] = Array.from(s.articles.values())
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((a) => ({
                  article_code: a.code,
                  article_name: a.name,
                  qty_by_line: a.qty,
                  total: a.total,
                }));
              return {
                code: s.code,
                name: s.name,
                articles,
                totals_by_line: s.totals,
                total: s.total,
              };
            });
          return {
            code: m.code,
            name: m.name,
            subclasses: subs,
            totals_by_line: m.totals,
            total: m.total,
          };
        });

      result.push({
        production_type: ptype,
        lines: sectionLines,
        mainClasses: mainList,
        totals_by_line: sectionTotals,
        total: sectionTotal,
      });
    });

    return result;
  }, [data, classFilter]);

  const exportMeta = { companyName: selectedCompany?.name ?? "", dateFrom, dateTo };

  return (
    <MainLayout title="Proizvodnja GP po šiframa i klasama">
      <div className="flex flex-col h-full min-h-0">
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[140px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[140px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Osnovna klasifikacija</Label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Sve klasifikacije" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sve klasifikacije</SelectItem>
                {mainClassOptions.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportProizvodnjaPoSifKlasamaToExcel(sections, exportMeta)}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportProizvodnjaPoSifKlasamaToPdf(sections, exportMeta)}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printProizvodnjaPoSifKlasama(sections, exportMeta)}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
          </div>
        </div>

        <TableScrollContainer className="flex-1">
          {isLoading ? (
            <div className="text-center py-8">Učitavanje...</div>
          ) : sections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nema podataka.</div>
          ) : (
            <div className="space-y-8">
              {sections.map((s) => (
                <div key={s.production_type}>
                  <h2 className="text-lg font-semibold mb-2 px-2 py-1 bg-primary/10 rounded">
                    Vrsta proizvodnje: {s.production_type}
                  </h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[110px]">Šifra</TableHead>
                        <TableHead className="min-w-[260px]">Naziv</TableHead>
                        {s.lines.map((l) => (
                          <TableHead key={l.code} className="text-right w-[90px]">{l.label}</TableHead>
                        ))}
                        <TableHead className="text-right w-[110px] font-semibold">Ukupno</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.mainClasses.map((mc) => (
                        <ClassBlock key={mc.code} mc={mc} lines={s.lines} />
                      ))}
                      <TableRow className="bg-muted/70 font-bold">
                        <TableCell colSpan={2} className="text-right">UKUPNO:</TableCell>
                        {s.lines.map((l) => (
                          <TableCell key={l.code} className="text-right font-mono">{fmtQty(s.totals_by_line[l.code] || 0)}</TableCell>
                        ))}
                        <TableCell className="text-right font-mono">{fmtQty(s.total)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </TableScrollContainer>
      </div>
    </MainLayout>
  );
}

function ClassBlock({ mc, lines }: { mc: SectionMainClass; lines: SectionLine[] }) {
  const colCount = 2 + lines.length + 1;
  return (
    <>
      <TableRow className="bg-primary/15">
        <TableCell colSpan={colCount} className="font-semibold">
          {mc.code} - {mc.name}
        </TableCell>
      </TableRow>
      {mc.subclasses.map((sc) => (
        <SubBlock key={sc.code} sc={sc} lines={lines} />
      ))}
    </>
  );
}

function SubBlock({ sc, lines }: { sc: SectionSubclass; lines: SectionLine[] }) {
  const colCount = 2 + lines.length + 1;
  return (
    <>
      <TableRow className="bg-muted/40">
        <TableCell colSpan={colCount} className="italic pl-6">
          {sc.code} - {sc.name}
        </TableCell>
      </TableRow>
      {sc.articles.map((a) => (
        <TableRow key={a.article_code} className="hover:bg-muted/30">
          <TableCell className="font-mono text-xs pl-10">{a.article_code}</TableCell>
          <TableCell className="text-xs">{a.article_name}</TableCell>
          {lines.map((l) => (
            <TableCell key={l.code} className="text-right font-mono">{fmtQty(a.qty_by_line[l.code] || 0)}</TableCell>
          ))}
          <TableCell className="text-right font-mono font-semibold">{fmtQty(a.total)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}
