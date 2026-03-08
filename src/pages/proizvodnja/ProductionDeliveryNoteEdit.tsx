import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { ArrowLeft, Lock, Save, Undo2, FileDown, FileSpreadsheet, Printer, History, MoreHorizontal, Eye } from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { ArticleProductionDeliveryNotesDialog } from "@/components/proizvodnja/ArticleProductionDeliveryNotesDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useProductionDeliveryNote,
  useProductionDeliveryNoteItems,
  useProductionDeliveryNotes,
  ProductionDeliveryNoteItem,
  PDN_STATUS_LABELS, PDN_STATUS_COLORS,
} from "@/hooks/useProductionDeliveryNotes";

import { useWarehouses } from "@/hooks/useWarehouses";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { useShiftManagers } from "@/hooks/useShiftManagers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumber, formatPrice, parseLocaleNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  exportProductionDeliveryNoteToExcel,
  exportProductionDeliveryNoteToPdf,
  printProductionDeliveryNote,
} from "@/lib/productionDeliveryNotePdfGenerator";

export default function ProductionDeliveryNoteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, user } = useAuth();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();

  const { data: note, isLoading: noteLoading } = useProductionDeliveryNote(id);
  const { items, isLoading: itemsLoading, invalidate: invalidateItems } = useProductionDeliveryNoteItems(id);
  const { postNote, unpostNote } = useProductionDeliveryNotes();
  
  const { warehouses } = useWarehouses(companyId);
  const { orders } = useWorkOrders();
  const { managers } = useShiftManagers();

  
  const gpWarehouses = useMemo(() => warehouses.filter((w) => w.warehouse_type === "9" && w.is_active), [warehouses]);
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === "launched" || o.status === "closed"),
    [orders]
  );

  // Header form state
  const [headerForm, setHeaderForm] = useState({
    delivery_date: "",
    warehouse_id: "",
    work_order_id: "",
    production_line: 1,
    shift_manager_1_id: "",
    shift_manager_2_id: "",
    shift_manager_3_id: "",
    note: "",
    responsible_person: "",
  });
  const [headerDirty, setHeaderDirty] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pdnDialogArticle, setPdnDialogArticle] = useState<{ id: string; code: string; name: string } | null>(null);

  useEffect(() => {
    if (note) {
      setHeaderForm({
        delivery_date: note.delivery_date,
        warehouse_id: note.warehouse_id,
        work_order_id: note.work_order_id || "",
        production_line: note.production_line,
        shift_manager_1_id: note.shift_manager_1_id || "",
        shift_manager_2_id: note.shift_manager_2_id || "",
        shift_manager_3_id: note.shift_manager_3_id || "",
        note: note.note || "",
        responsible_person: note.responsible_person,
      });
    }
  }, [note]);

  const isDraft = note?.status === "draft";

  const handleSaveHeader = async () => {
    if (!id) return;
    const { error } = await (supabase as any)
      .from("production_delivery_notes")
      .update({
        delivery_date: headerForm.delivery_date,
        warehouse_id: headerForm.warehouse_id,
        work_order_id: headerForm.work_order_id || null,
        production_line: headerForm.production_line,
        shift_manager_1_id: headerForm.shift_manager_1_id || null,
        shift_manager_2_id: headerForm.shift_manager_2_id || null,
        shift_manager_3_id: headerForm.shift_manager_3_id || null,
        note: headerForm.note || null,
        responsible_person: headerForm.responsible_person,
      })
      .eq("id", id);
    if (error) {
      toast.error("Greška pri čuvanju");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["production-delivery-note", id] });
    setHeaderDirty(false);
    toast.success("Zaglavlje sačuvano");
  };

  const updateHeaderField = (field: string, value: any) => {
    setHeaderForm((prev) => ({ ...prev, [field]: value }));
    setHeaderDirty(true);
  };

  // Update item
  const handleUpdateItem = async (
    item: ProductionDeliveryNoteItem,
    field: string,
    value: number
  ) => {
    const updates: any = { [field]: value };

    // Recalculate totals
    const s1 = field === "qty_shift_1" ? value : item.qty_shift_1;
    const s2 = field === "qty_shift_2" ? value : item.qty_shift_2;
    const s3 = field === "qty_shift_3" ? value : item.qty_shift_3;
    const total = s1 + s2 + s3;
    updates.qty_total = total;

    const kgPerUnit = field === "kg_per_unit" ? value : item.kg_per_unit;
    const unitLower = item.unit.toLowerCase();

    // Distribute delivered qty based on unit of measure
    if (unitLower === "kg") {
      updates.delivered_kg = total;
      updates.delivered_m = 0;
      updates.delivered_pcs = 0;
    } else if (unitLower === "m") {
      updates.delivered_m = total;
      updates.delivered_kg = kgPerUnit > 0 ? total * kgPerUnit : 0;
      updates.delivered_pcs = 0;
    } else {
      // kom or any other unit
      updates.delivered_pcs = total;
      updates.delivered_kg = kgPerUnit > 0 ? total * kgPerUnit : 0;
      updates.delivered_m = 0;
    }

    const price = field === "unit_price" ? value : item.unit_price;
    updates.item_value = total * price;

    const { error } = await (supabase as any)
      .from("production_delivery_note_items")
      .update(updates)
      .eq("id", item.id);
    if (error) toast.error("Greška pri ažuriranju stavke");
    invalidateItems();
  };

  // Totals
  const totalKg = items.reduce((s, i) => s + (i.delivered_kg || 0), 0);
  const totalValue = items.reduce((s, i) => s + (i.item_value || 0), 0);

  // Shift manager display
  const getManagerName = (managerId: string) => {
    const m = managers.find((mg) => mg.id === managerId);
    if (!m) return "";
    return [m.first_name, m.last_name].filter(Boolean).join(" ");
  };

  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const getExportContext = () => ({
    note,
    items,
    companyName: selectedCompany?.name || "",
    shiftManagers: {
      sm1: headerForm.shift_manager_1_id ? getManagerName(headerForm.shift_manager_1_id) : undefined,
      sm2: headerForm.shift_manager_2_id ? getManagerName(headerForm.shift_manager_2_id) : undefined,
      sm3: headerForm.shift_manager_3_id ? getManagerName(headerForm.shift_manager_3_id) : undefined,
    },
  });

  const handleExportExcel = () => {
    exportProductionDeliveryNoteToExcel(getExportContext());
  };

  const handleExportPdf = async () => {
    setIsPdfLoading(true);
    try { await exportProductionDeliveryNoteToPdf(getExportContext()); } finally { setIsPdfLoading(false); }
  };

  const handlePrint = async () => {
    setIsPdfLoading(true);
    try { await printProductionDeliveryNote(getExportContext()); } finally { setIsPdfLoading(false); }
  };

  if (noteLoading) return <MainLayout title="Predajnica GP"><p>Učitavanje...</p></MainLayout>;
  if (!note) return <MainLayout title="Predajnica GP"><p>Predajnica nije pronađena.</p></MainLayout>;

  return (
    <MainLayout title={`Predajnica GP ${note.delivery_number}`}>
      <div className="flex flex-col gap-4 h-full min-h-0">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/proizvodnja/predajnice")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-semibold">Predajnica {note.delivery_number}</h2>
            <Badge className={cn("text-xs", PDN_STATUS_COLORS[note.status])}>
              {PDN_STATUS_LABELS[note.status] ?? note.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} title="Excel">
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isPdfLoading} title="PDF">
              <FileDown className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPdfLoading} title="Štampaj">
              <Printer className="w-4 h-4 mr-1" /> Štampaj
            </Button>
            {isDraft && headerDirty && (
              <Button size="sm" onClick={handleSaveHeader}>
                <Save className="w-4 h-4 mr-2" /> Sačuvaj
              </Button>
            )}
            {isDraft && (
              <Button size="sm" onClick={() => {
                if (confirm("Proknjižiti predajnicu?")) postNote.mutateAsync(note.id);
              }}>
                <Lock className="w-4 h-4 mr-2" /> Proknjiži
              </Button>
            )}
            {!isDraft && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => {
                if (confirm("Poništiti knjiženje predajnice?")) unpostNote.mutateAsync(note.id);
              }}>
                <Undo2 className="w-4 h-4 mr-2" /> Poništi knjiženje
              </Button>
            )}
          </div>
        </div>

        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
          <div className="space-y-1">
            <Label className="text-xs">Datum</Label>
            <LocaleDateInput
              value={headerForm.delivery_date}
              onChange={(v) => updateHeaderField("delivery_date", v)}
              disabled={!isDraft}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Radni nalog</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={headerForm.work_order_id}
              onChange={(e) => updateHeaderField("work_order_id", e.target.value)}
              disabled={!isDraft}
            >
              <option value="">-- Bez RN --</option>
              {activeOrders.map((o) => (
                <option key={o.id} value={o.id}>{o.order_number}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Magacin</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={headerForm.warehouse_id}
              onChange={(e) => updateHeaderField("warehouse_id", e.target.value)}
              disabled={!isDraft}
            >
              <option value="">--</option>
              {gpWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Proizvodna linija (1-19)</Label>
            <Input
              type="number"
              min={1}
              max={19}
              value={headerForm.production_line}
              onChange={(e) => updateHeaderField("production_line", Math.min(19, Math.max(1, parseInt(e.target.value) || 1)))}
              disabled={!isDraft}
            />
          </div>
        </div>

        {/* Shift managers & note */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
          <div className="space-y-1">
            <Label className="text-xs">I smena - Šef</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={headerForm.shift_manager_1_id}
              onChange={(e) => updateHeaderField("shift_manager_1_id", e.target.value)}
              disabled={!isDraft}
            >
              <option value="">--</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {[m.first_name, m.last_name].filter(Boolean).join(" ") || `Slot ${m.slot_number}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">II smena - Šef</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={headerForm.shift_manager_2_id}
              onChange={(e) => updateHeaderField("shift_manager_2_id", e.target.value)}
              disabled={!isDraft}
            >
              <option value="">--</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {[m.first_name, m.last_name].filter(Boolean).join(" ") || `Slot ${m.slot_number}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">III smena - Šef</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
              value={headerForm.shift_manager_3_id}
              onChange={(e) => updateHeaderField("shift_manager_3_id", e.target.value)}
              disabled={!isDraft}
            >
              <option value="">--</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {[m.first_name, m.last_name].filter(Boolean).join(" ") || `Slot ${m.slot_number}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Odgovorno lice</Label>
            <Input
              value={headerForm.responsible_person}
              onChange={(e) => updateHeaderField("responsible_person", e.target.value)}
              disabled={!isDraft}
            />
          </div>
          <div className="space-y-1 md:col-span-4">
            <Label className="text-xs">Napomena</Label>
            <Input
              value={headerForm.note}
              onChange={(e) => updateHeaderField("note", e.target.value)}
              disabled={!isDraft}
              placeholder="Napomena..."
            />
          </div>
        </div>

        {/* Items table */}
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
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">R.br.</TableHead>
                  <TableHead className="w-[70px]">Šifra</TableHead>
                  <TableHead className="min-w-[120px]">Naziv</TableHead>
                  <TableHead className="w-[40px]">JM</TableHead>
                  <TableHead className="w-[85px] text-right">kg/JM</TableHead>
                  <TableHead className="w-[95px] text-right">Lans. kol.</TableHead>
                  <TableHead className="w-[95px] text-right">I smena</TableHead>
                  <TableHead className="w-[95px] text-right">II smena</TableHead>
                  <TableHead className="w-[95px] text-right">III smena</TableHead>
                  <TableHead className="w-[95px] text-right">Ukupno</TableHead>
                  <TableHead className="w-[95px] text-right">Pred. kg</TableHead>
                  <TableHead className="w-[95px] text-right">Pred. m</TableHead>
                  <TableHead className="w-[95px] text-right">Pred. kom</TableHead>
                  <TableHead className="w-[85px] text-right">Škart</TableHead>
                   <TableHead className="w-[100px] text-right">Cena</TableHead>
                   <TableHead className="w-[110px] text-right">Vrednost</TableHead>
                   <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-6 text-muted-foreground">
                      Nema stavki.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      idx={idx}
                      isDraft={isDraft}
                      onUpdate={handleUpdateItem}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>
      </div>
      <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={note.id} documentName={note.delivery_number} documentType="production_delivery_note" />
    </MainLayout>
  );
}

// Separate row component for cleaner code
function ItemRow({
  item,
  idx,
  isDraft,
  onUpdate,
}: {
  item: ProductionDeliveryNoteItem;
  idx: number;
  isDraft: boolean;
  onUpdate: (item: ProductionDeliveryNoteItem, field: string, value: number) => Promise<void>;
}) {
  const handleNumberBlur = (field: string, rawValue: string) => {
    const num = parseLocaleNumber(rawValue);
    onUpdate(item, field, num);
  };

  const numCell = (field: string, value: number, decimalPlaces = 3, minDecimals?: number) => {
    const min = minDecimals ?? decimalPlaces;
    if (!isDraft) {
      return <span className="font-mono text-xs">{formatNumber(value, { minimumFractionDigits: min, maximumFractionDigits: decimalPlaces })}</span>;
    }
    return (
      <LocaleNumberInput
        value={formatNumber(value, { minimumFractionDigits: min, maximumFractionDigits: decimalPlaces }).replace(/\s/g, '')}
        onChange={() => {}}
        onBlur={(e) => handleNumberBlur(field, e.currentTarget.value)}
        decimalPlaces={decimalPlaces}
        className="h-7 text-xs w-full text-right"
      />
    );
  };

  return (
    <TableRow>
      <TableCell className="text-xs">{idx + 1}</TableCell>
      <TableCell className="font-mono text-[11px]">{item.article_code}</TableCell>
      <TableCell className="text-xs truncate max-w-[120px]" title={item.article_name}>{item.article_name}</TableCell>
      <TableCell className="text-xs">{item.unit}</TableCell>
      <TableCell className="text-right">{numCell("kg_per_unit", item.kg_per_unit, 3, 0)}</TableCell>
      <TableCell className="text-right">
        <span className="font-mono text-xs">{formatNumber(item.launched_qty, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</span>
      </TableCell>
      <TableCell className="text-right">{numCell("qty_shift_1", item.qty_shift_1, 3, 0)}</TableCell>
      <TableCell className="text-right">{numCell("qty_shift_2", item.qty_shift_2, 3, 0)}</TableCell>
      <TableCell className="text-right">{numCell("qty_shift_3", item.qty_shift_3, 3, 0)}</TableCell>
      <TableCell className="text-right">
        <span className="font-mono text-xs font-semibold">{formatNumber(item.qty_total, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}</span>
      </TableCell>
      <TableCell className="text-right">{numCell("delivered_kg", item.delivered_kg, 2, 0)}</TableCell>
      <TableCell className="text-right">{numCell("delivered_m", item.delivered_m, 2, 0)}</TableCell>
      <TableCell className="text-right">{numCell("delivered_pcs", item.delivered_pcs, 3, 0)}</TableCell>
      <TableCell className="text-right">{numCell("scrap_qty", item.scrap_qty, 3, 0)}</TableCell>
      <TableCell className="text-right">{numCell("unit_price", item.unit_price, 2)}</TableCell>
      <TableCell className="text-right">
        <span className="font-mono text-xs font-semibold">{formatPrice(item.item_value)}</span>
      </TableCell>
    </TableRow>
  );
}