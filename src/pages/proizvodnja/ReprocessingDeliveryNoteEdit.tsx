import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { ArrowLeft, Lock, Save, Undo2, History, MoreHorizontal, Eye, Barcode } from "lucide-react";
import { BarcodesPrintDialog } from "@/components/sifarnici/BarcodesPrintDialog";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { ArticleReprocessingDeliveryNotesDialog } from "@/components/proizvodnja/ArticleReprocessingDeliveryNotesDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  useReprocessingDeliveryNote, useReprocessingDeliveryNoteItems, useReprocessingDeliveryNotes,
  ReprocessingDeliveryNoteItem, RDN_STATUS_LABELS, RDN_STATUS_COLORS,
} from "@/hooks/useReprocessingDeliveryNotes";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useReprocessingWorkOrders } from "@/hooks/useReprocessingWorkOrders";
import { useShiftManagers } from "@/hooks/useShiftManagers";
import { useProductionLines } from "@/hooks/useProductionLines";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumber, parseLocaleNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import React from "react";

function ItemRow({ item, idx, isDraft, onUpdate, onShowHistory }: { item: ReprocessingDeliveryNoteItem; idx: number; isDraft: boolean; onUpdate: (item: ReprocessingDeliveryNoteItem, field: string, value: number) => void; onShowHistory: (a: { id: string; code: string; name: string }) => void }) {
  return (
    <TableRow>
      <TableCell>{idx + 1}</TableCell>
      <TableCell className="font-mono text-xs">{item.article_code}</TableCell>
      <TableCell>{item.article_name}</TableCell>
      <TableCell>{item.unit}</TableCell>
      <TableCell className="text-right">{formatNumber(item.kg_per_unit, { minimumFractionDigits: 3 })}</TableCell>
      <TableCell className="text-right">{formatNumber(item.launched_qty, { minimumFractionDigits: 2 })}</TableCell>
      <TableCell className="text-right"><LocaleNumberInput value={String(item.qty_shift_1 ?? 0)} onChange={(v) => onUpdate(item, "qty_shift_1", parseLocaleNumber(v))} disabled={!isDraft} className="w-[80px] text-right h-8" /></TableCell>
      <TableCell className="text-right"><LocaleNumberInput value={String(item.qty_shift_2 ?? 0)} onChange={(v) => onUpdate(item, "qty_shift_2", parseLocaleNumber(v))} disabled={!isDraft} className="w-[80px] text-right h-8" /></TableCell>
      <TableCell className="text-right"><LocaleNumberInput value={String(item.qty_shift_3 ?? 0)} onChange={(v) => onUpdate(item, "qty_shift_3", parseLocaleNumber(v))} disabled={!isDraft} className="w-[80px] text-right h-8" /></TableCell>
      <TableCell className="text-right font-mono">{formatNumber(item.qty_total, { minimumFractionDigits: 2 })}</TableCell>
      <TableCell className="text-right font-mono">{formatNumber(item.delivered_kg, { minimumFractionDigits: 2 })}</TableCell>
      <TableCell className="text-right"><LocaleNumberInput value={String(item.scrap_qty ?? 0)} onChange={(v) => onUpdate(item, "scrap_qty", parseLocaleNumber(v))} disabled={!isDraft} className="w-[70px] text-right h-8" /></TableCell>
      <TableCell className="text-right font-mono">{formatNumber(item.unit_price, { minimumFractionDigits: 2 })}</TableCell>
      <TableCell className="text-right font-mono">{formatNumber(item.item_value, { minimumFractionDigits: 2 })}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onShowHistory({ id: item.article_id, code: item.article_code, name: item.article_name })}>
              <Eye className="w-4 h-4 mr-2" /> Pregled na predajnicama
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export default function ReprocessingDeliveryNoteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();

  const { data: note, isLoading: noteLoading } = useReprocessingDeliveryNote(id);
  const { items, invalidate: invalidateItems } = useReprocessingDeliveryNoteItems(id);
  const { postNote, unpostNote } = useReprocessingDeliveryNotes();
  const { warehouses } = useWarehouses(companyId);
  const { orders } = useReprocessingWorkOrders();
  const { managers } = useShiftManagers();
  const { data: productionLines = [] } = useProductionLines();

  const gpWarehouses = useMemo(() => warehouses.filter((w) => w.warehouse_type === "9" && w.is_active), [warehouses]);
  const activeOrders = useMemo(() => orders.filter((o) => o.status === "launched" || o.status === "closed"), [orders]);
  const activeProductionLines = useMemo(() => {
    const list = productionLines.filter((l) => l.is_active);
    if (note && !list.some((l) => l.code === note.production_line)) {
      const existing = productionLines.find((l) => l.code === note.production_line);
      if (existing) return [...list, existing].sort((a, b) => a.code - b.code);
    }
    return list;
  }, [productionLines, note]);

  const [headerForm, setHeaderForm] = useState({ delivery_date: "", warehouse_id: "", work_order_id: "", production_line: 1, shift_manager_1_id: "", shift_manager_2_id: "", shift_manager_3_id: "", note: "", responsible_person: "" });
  const [headerDirty, setHeaderDirty] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [barcodesOpen, setBarcodesOpen] = useState(false);
  const [pdnDialogArticle, setPdnDialogArticle] = useState<{ id: string; code: string; name: string } | null>(null);

  useEffect(() => {
    if (note) {
      setHeaderForm({
        delivery_date: note.delivery_date, warehouse_id: note.warehouse_id, work_order_id: note.work_order_id || "",
        production_line: note.production_line, shift_manager_1_id: note.shift_manager_1_id || "",
        shift_manager_2_id: note.shift_manager_2_id || "", shift_manager_3_id: note.shift_manager_3_id || "",
        note: note.note || "", responsible_person: note.responsible_person,
      });
    }
  }, [note]);

  const isDraft = note?.status === "draft";

  const handleSaveHeader = async () => {
    if (!id) return;
    if (!productionLines.some((l) => l.code === headerForm.production_line && l.is_active)) {
      toast.error("Izaberite važeću proizvodnu liniju iz šifarnika");
      return;
    }
    const { error } = await (supabase as any).from("reprocessing_delivery_notes").update({
      delivery_date: headerForm.delivery_date, warehouse_id: headerForm.warehouse_id,
      work_order_id: headerForm.work_order_id || null, production_line: headerForm.production_line,
      shift_manager_1_id: headerForm.shift_manager_1_id || null, shift_manager_2_id: headerForm.shift_manager_2_id || null,
      shift_manager_3_id: headerForm.shift_manager_3_id || null, note: headerForm.note || null,
      responsible_person: headerForm.responsible_person,
    }).eq("id", id);
    if (error) { toast.error("Greška pri čuvanju"); return; }
    queryClient.invalidateQueries({ queryKey: ["reprocessing-delivery-note", id] });
    setHeaderDirty(false);
    toast.success("Zaglavlje sačuvano");
  };

  const updateHeaderField = (field: string, value: any) => { setHeaderForm((p) => ({ ...p, [field]: value })); setHeaderDirty(true); };

  const handleUpdateItem = async (item: ReprocessingDeliveryNoteItem, field: string, value: number) => {
    const updates: any = { [field]: value };
    const s1 = field === "qty_shift_1" ? value : item.qty_shift_1;
    const s2 = field === "qty_shift_2" ? value : item.qty_shift_2;
    const s3 = field === "qty_shift_3" ? value : item.qty_shift_3;
    const total = s1 + s2 + s3;
    updates.qty_total = total;
    const kgPerUnit = field === "kg_per_unit" ? value : item.kg_per_unit;
    const unitLower = item.unit.toLowerCase();
    if (unitLower === "kg") { updates.delivered_kg = total; updates.delivered_m = 0; updates.delivered_pcs = 0; }
    else if (unitLower === "m") { updates.delivered_m = total; updates.delivered_kg = kgPerUnit > 0 ? total * kgPerUnit : 0; updates.delivered_pcs = 0; }
    else { updates.delivered_pcs = total; updates.delivered_kg = kgPerUnit > 0 ? total * kgPerUnit : 0; updates.delivered_m = 0; }
    const price = field === "unit_price" ? value : item.unit_price;
    updates.item_value = total * price;
    await (supabase as any).from("reprocessing_delivery_note_items").update(updates).eq("id", item.id);
    invalidateItems();
  };

  const totalKg = items.reduce((s, i) => s + (i.delivered_kg || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.item_value || 0), 0);

  if (noteLoading) return <MainLayout title="Predajnica preradu"><p>Učitavanje...</p></MainLayout>;
  if (!note) return <MainLayout title="Predajnica preradu"><p>Predajnica nije pronađena.</p></MainLayout>;

  return (
    <MainLayout title={`Predajnica preradu ${note.delivery_number}`}>
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4 h-full min-h-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/proizvodnja/predajnice-prerada")}><ArrowLeft className="w-5 h-5" /></Button>
            <h2 className="text-lg font-semibold">Predajnica {note.delivery_number}</h2>
            <Badge className={cn("text-xs", RDN_STATUS_COLORS[note.status])}>{RDN_STATUS_LABELS[note.status] ?? note.status}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena"><History className="w-4 h-4" /></Button>
            {items.length > 0 && <Button variant="outline" size="sm" onClick={() => setBarcodesOpen(true)}><Barcode className="w-4 h-4 mr-2" /> Barkodovi</Button>}
            {isDraft && headerDirty && <Button onClick={handleSaveHeader}><Save className="w-4 h-4 mr-2" /> Sačuvaj</Button>}
            {isDraft && <Button onClick={() => { if (confirm("Proknjižiti predajnicu?")) postNote.mutateAsync(note.id); }}><Lock className="w-4 h-4 mr-2" /> Proknjiži</Button>}
            {!isDraft && <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => { if (confirm("Poništiti knjiženje?")) unpostNote.mutateAsync(note.id); }}><Undo2 className="w-4 h-4 mr-2" /> Poništi knjiženje</Button>}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
          <div className="space-y-1"><Label className="text-xs">Datum</Label><LocaleDateInput value={headerForm.delivery_date} onChange={(v) => updateHeaderField("delivery_date", v)} disabled={!isDraft} minDate={minDate} maxDate={maxDate} /></div>
          <div className="space-y-1">
            <Label className="text-xs">Radni nalog</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" value={headerForm.work_order_id} onChange={(e) => updateHeaderField("work_order_id", e.target.value)} disabled={!isDraft}>
              <option value="">-- Bez RN --</option>
              {activeOrders.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Magacin</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" value={headerForm.warehouse_id} onChange={(e) => updateHeaderField("warehouse_id", e.target.value)} disabled={!isDraft}>
              <option value="">--</option>
              {gpWarehouses.map((w) => <option key={w.id} value={w.id}>{w.code} - {w.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Proizvodna linija</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" value={headerForm.production_line} onChange={(e) => updateHeaderField("production_line", parseInt(e.target.value) || 0)} disabled={!isDraft}>
              {activeProductionLines.length === 0 && <option value={0}>-- Nema definisanih linija --</option>}
              {activeProductionLines.map((l) => <option key={l.id} value={l.code}>{l.code} - {l.name} ({l.production_type})</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
          {[{ label: "I smena - Šef", field: "shift_manager_1_id" }, { label: "II smena - Šef", field: "shift_manager_2_id" }, { label: "III smena - Šef", field: "shift_manager_3_id" }].map(({ label, field }) => (
            <div key={field} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" value={(headerForm as any)[field]} onChange={(e) => updateHeaderField(field, e.target.value)} disabled={!isDraft}>
                <option value="">--</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{[m.first_name, m.last_name].filter(Boolean).join(" ") || `Slot ${m.slot_number}`}</option>)}
              </select>
            </div>
          ))}
          <div className="space-y-1"><Label className="text-xs">Odgovorno lice</Label><Input value={headerForm.responsible_person} onChange={(e) => updateHeaderField("responsible_person", e.target.value)} disabled={!isDraft} /></div>
          <div className="space-y-1 md:col-span-4"><Label className="text-xs">Napomena</Label><Input value={headerForm.note} onChange={(e) => updateHeaderField("note", e.target.value)} disabled={!isDraft} placeholder="Napomena..." /></div>
        </div>

        <div className="border rounded-lg flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">Stavke</h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Ukupno kg: <strong>{formatNumber(totalKg, { minimumFractionDigits: 2 })}</strong></span>
              <span>Ukupna vrednost: <strong>{formatNumber(totalValue, { minimumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
          <TableScrollContainer className="flex-1">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-[40px]">R.br.</TableHead>
                <TableHead className="w-[70px]">Šifra</TableHead>
                <TableHead className="min-w-[120px]">Naziv</TableHead>
                <TableHead className="w-[40px]">JM</TableHead>
                <TableHead className="w-[85px] text-right">kg/JM</TableHead>
                <TableHead className="w-[85px] text-right">Lans. kol.</TableHead>
                <TableHead className="w-[85px] text-right">I smena</TableHead>
                <TableHead className="w-[85px] text-right">II smena</TableHead>
                <TableHead className="w-[85px] text-right">III smena</TableHead>
                <TableHead className="w-[85px] text-right">Ukupno</TableHead>
                <TableHead className="w-[85px] text-right">Pred. kg</TableHead>
                <TableHead className="w-[75px] text-right">Škart</TableHead>
                <TableHead className="w-[90px] text-right">Cena</TableHead>
                 <TableHead className="w-[100px] text-right">Vrednost</TableHead>
                 <TableHead className="w-[40px]"></TableHead>
               </TableRow></TableHeader>
               <TableBody>
                 {items.length === 0 ? (
                   <TableRow><TableCell colSpan={15} className="text-center py-6 text-muted-foreground">Nema stavki.</TableCell></TableRow>
                 ) : items.map((item, idx) => (
                   <ItemRow key={item.id} item={item} idx={idx} isDraft={isDraft} onUpdate={handleUpdateItem} onShowHistory={(a) => setPdnDialogArticle(a)} />
                 ))}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>
      </div>
      {note && (
        <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={note.id} documentName={note.delivery_number} documentType="reprocessing_delivery_note" />
      )}
      <ArticleReprocessingDeliveryNotesDialog
        open={!!pdnDialogArticle}
        onOpenChange={(o) => { if (!o) setPdnDialogArticle(null); }}
        articleId={pdnDialogArticle?.id ?? null}
        articleCode={pdnDialogArticle?.code ?? ""}
        articleName={pdnDialogArticle?.name ?? ""}
      />
      <BarcodesPrintDialog
        open={barcodesOpen}
        onOpenChange={setBarcodesOpen}
        articles={(() => {
          const seen = new Set<string>();
          return items.filter((item) => {
            if (seen.has(item.article_code)) return false;
            seen.add(item.article_code);
            return true;
          }).map((item) => ({ id: item.id, code: item.article_code, name: item.article_name }));
        })()}
      />
    </MainLayout>
  );
}
