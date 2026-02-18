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
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { ArrowLeft, Plus, Trash2, Lock, Save } from "lucide-react";
import {
  useProductionDeliveryNote,
  useProductionDeliveryNoteItems,
  useProductionDeliveryNotes,
  ProductionDeliveryNoteItem,
  PDN_STATUS_LABELS, PDN_STATUS_COLORS,
} from "@/hooks/useProductionDeliveryNotes";
import { useArticles } from "@/hooks/useArticles";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { useShiftManagers } from "@/hooks/useShiftManagers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumber, formatPrice, parseLocaleNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export default function ProductionDeliveryNoteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, user } = useAuth();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();

  const { data: note, isLoading: noteLoading } = useProductionDeliveryNote(id);
  const { items, isLoading: itemsLoading, invalidate: invalidateItems } = useProductionDeliveryNoteItems(id);
  const { postNote } = useProductionDeliveryNotes();
  const { articles } = useArticles(companyId);
  const { warehouses } = useWarehouses(companyId);
  const { orders } = useWorkOrders();
  const { managers } = useShiftManagers();

  const gpArticles = useMemo(() => articles.filter((a) => a.svk === "9" && a.is_active), [articles]);
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

  // Item being added
  const [newArticleId, setNewArticleId] = useState("");

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

  // Add item
  const handleAddItem = async () => {
    if (!newArticleId || !id || !companyId) return;
    const article = gpArticles.find((a) => a.id === newArticleId);
    if (!article) return;

    // Get launched qty from work order if linked
    let launchedQty = 0;
    if (note?.work_order_id) {
      const { data: woItems } = await supabase
        .from("work_order_items")
        .select("launched_qty")
        .eq("work_order_id", note.work_order_id)
        .eq("article_id", newArticleId)
        .limit(1);
      if (woItems && woItems.length > 0) {
        launchedQty = Number(woItems[0].launched_qty || 0);
      }
    }

    const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.item_order)) + 1 : 1;

    const { error } = await (supabase as any).from("production_delivery_note_items").insert({
      delivery_note_id: id,
      company_id: companyId,
      article_id: newArticleId,
      article_code: article.code,
      article_name: article.name,
      unit: article.unit,
      kg_per_unit: article.kg_po_jm ?? 0,
      launched_qty: launchedQty,
      unit_price: article.purchase_price ?? 0,
      item_order: nextOrder,
    });

    if (error) {
      toast.error("Greška pri dodavanju stavke");
      return;
    }
    setNewArticleId("");
    invalidateItems();
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
    updates.delivered_kg = total * kgPerUnit;
    updates.delivered_pcs = total;

    const price = field === "unit_price" ? value : item.unit_price;
    updates.item_value = total * price;

    const { error } = await (supabase as any)
      .from("production_delivery_note_items")
      .update(updates)
      .eq("id", item.id);
    if (error) toast.error("Greška pri ažuriranju stavke");
    invalidateItems();
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    const { error } = await (supabase as any)
      .from("production_delivery_note_items")
      .delete()
      .eq("id", itemId);
    if (error) toast.error("Greška pri brisanju stavke");
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
          <div className="flex gap-2">
            {isDraft && headerDirty && (
              <Button onClick={handleSaveHeader}>
                <Save className="w-4 h-4 mr-2" /> Sačuvaj
              </Button>
            )}
            {isDraft && (
              <Button variant="outline" onClick={() => {
                if (confirm("Proknjižiti predajnicu?")) postNote.mutateAsync(note.id);
              }}>
                <Lock className="w-4 h-4 mr-2" /> Proknjiži
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
          {isDraft && (
            <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
              <div className="flex-1 max-w-md">
                <SearchableArticleSelect
                  articles={gpArticles}
                  value={newArticleId}
                  onValueChange={(id) => setNewArticleId(id)}
                  placeholder="Izaberite gotov proizvod..."
                />
              </div>
              <Button size="sm" onClick={handleAddItem} disabled={!newArticleId}>
                <Plus className="w-4 h-4 mr-1" /> Dodaj
              </Button>
            </div>
          )}
          <TableScrollContainer className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">R.br.</TableHead>
                  <TableHead className="w-[80px]">Šifra</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead className="w-[50px]">JM</TableHead>
                  <TableHead className="w-[80px] text-right">kg/JM</TableHead>
                  <TableHead className="w-[90px] text-right">Lans. kol.</TableHead>
                  <TableHead className="w-[90px] text-right">I smena</TableHead>
                  <TableHead className="w-[90px] text-right">II smena</TableHead>
                  <TableHead className="w-[90px] text-right">III smena</TableHead>
                  <TableHead className="w-[90px] text-right">Ukupno</TableHead>
                  <TableHead className="w-[90px] text-right">Pred. kg</TableHead>
                  <TableHead className="w-[90px] text-right">Pred. m</TableHead>
                  <TableHead className="w-[90px] text-right">Pred. kom</TableHead>
                  <TableHead className="w-[80px] text-right">Škart</TableHead>
                  <TableHead className="w-[100px] text-right">Cena</TableHead>
                  <TableHead className="w-[110px] text-right">Vrednost</TableHead>
                  {isDraft && <TableHead className="w-[50px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isDraft ? 17 : 16} className="text-center py-6 text-muted-foreground">
                      Nema stavki. Dodajte gotove proizvode.
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
                      onDelete={handleDeleteItem}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>
      </div>
    </MainLayout>
  );
}

// Separate row component for cleaner code
function ItemRow({
  item,
  idx,
  isDraft,
  onUpdate,
  onDelete,
}: {
  item: ProductionDeliveryNoteItem;
  idx: number;
  isDraft: boolean;
  onUpdate: (item: ProductionDeliveryNoteItem, field: string, value: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const handleNumberBlur = (field: string, rawValue: string) => {
    const num = parseLocaleNumber(rawValue);
    onUpdate(item, field, num);
  };

  const numCell = (field: string, value: number, decimalPlaces = 3) => {
    if (!isDraft) {
      return <span className="font-mono">{formatNumber(value, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces })}</span>;
    }
    return (
      <LocaleNumberInput
        value={formatNumber(value, { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).replace(/\s/g, '')}
        onChange={() => {}}
        onBlur={(e) => handleNumberBlur(field, e.currentTarget.value)}
        decimalPlaces={decimalPlaces}
        className="h-7 text-sm w-full text-right"
      />
    );
  };

  return (
    <TableRow>
      <TableCell>{idx + 1}</TableCell>
      <TableCell className="font-mono text-xs">{item.article_code}</TableCell>
      <TableCell>{item.article_name}</TableCell>
      <TableCell>{item.unit}</TableCell>
      <TableCell className="text-right">{numCell("kg_per_unit", item.kg_per_unit, 3)}</TableCell>
      <TableCell className="text-right">
        <span className="font-mono">{formatNumber(item.launched_qty, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
      </TableCell>
      <TableCell className="text-right">{numCell("qty_shift_1", item.qty_shift_1, 3)}</TableCell>
      <TableCell className="text-right">{numCell("qty_shift_2", item.qty_shift_2, 3)}</TableCell>
      <TableCell className="text-right">{numCell("qty_shift_3", item.qty_shift_3, 3)}</TableCell>
      <TableCell className="text-right">
        <span className="font-mono font-semibold">{formatNumber(item.qty_total, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
      </TableCell>
      <TableCell className="text-right">{numCell("delivered_kg", item.delivered_kg, 2)}</TableCell>
      <TableCell className="text-right">{numCell("delivered_m", item.delivered_m, 2)}</TableCell>
      <TableCell className="text-right">{numCell("delivered_pcs", item.delivered_pcs, 3)}</TableCell>
      <TableCell className="text-right">{numCell("scrap_qty", item.scrap_qty, 3)}</TableCell>
      <TableCell className="text-right">{numCell("unit_price", item.unit_price, 2)}</TableCell>
      <TableCell className="text-right">
        <span className="font-mono font-semibold">{formatPrice(item.item_value)}</span>
      </TableCell>
      {isDraft && (
        <TableCell>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(item.id)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}
