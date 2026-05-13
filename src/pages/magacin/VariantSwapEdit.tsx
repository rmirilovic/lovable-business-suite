import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, BookCheck, Undo2, ArrowLeft, Save } from "lucide-react";
import { useVariantSwaps, VariantSwap, VariantSwapFormData } from "@/hooks/useVariantSwaps";
import { useArticles } from "@/hooks/useArticles";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useArticleVariants, useArticleVariantAssignments } from "@/hooks/useArticleVariants";
import { useWarehouseStockByVariant } from "@/hooks/useWarehouseStockByVariant";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { SearchableArticleSelect, Article } from "@/components/ui/searchable-article-select";

export default function VariantSwapEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const isNew = id === "new";
  const [swap, setSwap] = useState<VariantSwap | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);

  const { createSwap, updateSwap, postSwap, unpostSwap } = useVariantSwaps();
  const { articles } = useArticles(selectedCompany?.id);
  const { warehouses } = useWarehouses(selectedCompany?.id);
  const { variants } = useArticleVariants(selectedCompany?.id);
  const activeWarehouses = warehouses.filter((w) => w.is_active);

  const [warehouseId, setWarehouseId] = useState("");
  const [swapDate, setSwapDate] = useState(new Date().toISOString().split("T")[0]);
  const [articleId, setArticleId] = useState("");
  const [sourceVariantId, setSourceVariantId] = useState<string>("");
  const [targetVariantId, setTargetVariantId] = useState("");
  const [quantityStr, setQuantityStr] = useState("0,000");
  const [note, setNote] = useState("");

  // Get article's assigned variants
  const { assignments } = useArticleVariantAssignments(articleId || undefined, selectedCompany?.id);
  const articleVariants = useMemo(() => {
    return assignments.map((a) => a.variant).filter(Boolean) as NonNullable<typeof assignments[0]["variant"]>[];
  }, [assignments]);

  // Get stock by variant to show available qty
  const { data: stockByVariant } = useWarehouseStockByVariant(
    selectedCompany?.id, warehouseId || undefined, undefined, swapDate
  );

  const selectedArticle = articles.find((a) => a.id === articleId);

  const articleVariantStocks = useMemo(() => {
    if (!stockByVariant || !articleId) return [];
    return stockByVariant.filter((s) => s.article_id === articleId);
  }, [stockByVariant, articleId]);

  const sourceVariantStock = useMemo(() => {
    if (!stockByVariant || !articleId) return 0;
    const vid = sourceVariantId || null;
    return stockByVariant.filter((s) => s.article_id === articleId && s.variant_id === vid).reduce((sum, s) => sum + s.balance_qty, 0);
  }, [stockByVariant, articleId, sourceVariantId]);

  // Load existing swap
  useEffect(() => {
    if (isNew || !id) return;
    const load = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("variant_swaps")
        .select(`*, article:articles!variant_swaps_article_id_fkey(id, code, name, unit), warehouse:warehouses!variant_swaps_warehouse_id_fkey(id, code, name), source_variant:article_variants!variant_swaps_source_variant_id_fkey(id, code, description), target_variant:article_variants!variant_swaps_target_variant_id_fkey(id, code, description)`)
        .eq("id", id)
        .single();
      if (error || !data) {
        toast.error("Dokument nije pronađen");
        navigate("/magacin/zamene-varijanti");
        return;
      }
      const s = data as unknown as VariantSwap;
      setSwap(s);
      setWarehouseId(s.warehouse_id);
      setSwapDate(s.swap_date);
      setArticleId(s.article_id);
      setSourceVariantId(s.source_variant_id || "");
      setTargetVariantId(s.target_variant_id);
      setQuantityStr(formatDecimal(s.quantity, 3));
      setNote(s.note || "");
      setIsLoading(false);
    };
    load();
  }, [id, isNew, navigate]);

  const isPosted = swap?.status === "posted";
  const isDisabled = isPosted || !canEdit;

  const handleSave = async () => {
    if (!articleId || !warehouseId || !sourceVariantId || !targetVariantId) {
      toast.error("Artikal, magacin, izvorna i ciljna varijanta su obavezni");
      return;
    }
    const qty = parseLocaleNumber(quantityStr);
    if (qty <= 0) { toast.error("Količina mora biti veća od 0"); return; }
    if (qty > sourceVariantStock) {
      toast.error(`Nema dovoljno na stanju izvorne varijante (${formatDecimal(sourceVariantStock, 3)})`);
      return;
    }
    if (sourceVariantId === targetVariantId) {
      toast.error("Izvorna i ciljna varijanta moraju biti različite");
      return;
    }

    setIsSaving(true);
    try {
      const formData: VariantSwapFormData = {
        swap_date: swapDate,
        article_id: articleId,
        warehouse_id: warehouseId,
        source_variant_id: sourceVariantId || null,
        target_variant_id: targetVariantId,
        quantity: qty,
        note: note || null,
      };

      if (isNew) {
        const result = await createSwap.mutateAsync(formData);
        navigate(`/magacin/zamene-varijanti/${result.id}`, { replace: true });
      } else if (swap) {
        const result = await updateSwap.mutateAsync({ id: swap.id, ...formData });
        setSwap(result);
      }
    } catch { /* handled */ } finally {
      setIsSaving(false);
    }
  };

  const handlePost = async () => {
    if (!swap) return;
    const qty = parseLocaleNumber(quantityStr);
    if (qty > sourceVariantStock) {
      toast.error("Nema dovoljno na stanju izvorne varijante");
      return;
    }
    await postSwap.mutateAsync(swap.id);
    const { data } = await supabase.from("variant_swaps").select(`*, article:articles!variant_swaps_article_id_fkey(id, code, name, unit), warehouse:warehouses!variant_swaps_warehouse_id_fkey(id, code, name), source_variant:article_variants!variant_swaps_source_variant_id_fkey(id, code, description), target_variant:article_variants!variant_swaps_target_variant_id_fkey(id, code, description)`).eq("id", swap.id).single();
    if (data) setSwap(data as unknown as VariantSwap);
    setPostDialogOpen(false);
  };

  const handleUnpost = async () => {
    if (!swap) return;
    await unpostSwap.mutateAsync(swap.id);
    const { data } = await supabase.from("variant_swaps").select(`*, article:articles!variant_swaps_article_id_fkey(id, code, name, unit), warehouse:warehouses!variant_swaps_warehouse_id_fkey(id, code, name), source_variant:article_variants!variant_swaps_source_variant_id_fkey(id, code, description), target_variant:article_variants!variant_swaps_target_variant_id_fkey(id, code, description)`).eq("id", swap.id).single();
    if (data) setSwap(data as unknown as VariantSwap);
    setUnpostDialogOpen(false);
  };

  const handleArticleSelect = (artId: string) => {
    setArticleId(artId);
    setSourceVariantId("");
    setTargetVariantId("");
  };

  if (isLoading) return <MainLayout title="Zamena varijante"><div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div></MainLayout>;

  return (
    <MainLayout title={`Zamena varijante${swap ? ` — ${swap.swap_number}` : ""}`}>
      <div className="flex flex-col gap-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/magacin/zamene-varijanti")}><ArrowLeft className="w-4 h-4 mr-2" />Nazad</Button>
          <div className="flex items-center gap-2">
            {swap && (
              <Badge variant={isPosted ? "default" : "outline"} className="text-sm">
                {isPosted ? "Proknjiženo" : "Nacrt"}
              </Badge>
            )}
            {!isPosted && canEdit && (
              <Button onClick={handleSave} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Sačuvaj</Button>
            )}
            {!isNew && !isPosted && canPost && (
              <Button variant="default" onClick={() => setPostDialogOpen(true)}><BookCheck className="w-4 h-4 mr-2" />Proknjiži</Button>
            )}
            {isPosted && canPost && (
              <Button variant="outline" onClick={() => setUnpostDialogOpen(true)}><Undo2 className="w-4 h-4 mr-2" />Poništi</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-card">
          <div className="space-y-2">
            <Label>Datum</Label>
            <LocaleDateInput value={swapDate} onChange={setSwapDate} disabled={isDisabled} minDate={minDate} maxDate={maxDate} />
          </div>
          <div className="space-y-2">
            <Label>Magacin *</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId} disabled={isDisabled}>
              <SelectTrigger><SelectValue placeholder="Izaberite..." /></SelectTrigger>
              <SelectContent>
                {activeWarehouses.map((w) => (<SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Artikal *</Label>
            <SearchableArticleSelect
              articles={articles.filter((a) => a.is_active)}
              value={articleId}
              onValueChange={(v) => handleArticleSelect(v)}
              disabled={isDisabled}
              placeholder="Izaberite artikal..."
            />
            {selectedArticle && (
              <p className="text-sm text-muted-foreground">
                {selectedArticle.code} — {selectedArticle.name} | JM: {selectedArticle.unit} | Ukupno na stanju: {formatDecimal(articleVariantStocks.reduce((s, v) => s + v.balance_qty, 0), 3)}
              </p>
            )}
            {selectedArticle && warehouseId && articleVariantStocks.length > 0 && (
              <div className="mt-2 border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium">Šifra varijante</th>
                      <th className="text-left px-3 py-1.5 font-medium">Opis</th>
                      <th className="text-right px-3 py-1.5 font-medium">Stanje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articleVariantStocks.map((s) => (
                      <tr key={s.variant_id || "none"} className="border-t">
                        <td className="px-3 py-1.5">{s.variant_code || "—"}</td>
                        <td className="px-3 py-1.5">{s.variant_description || ""}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatDecimal(s.balance_qty, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Sa varijante (izvorna) *</Label>
            <Select value={sourceVariantId} onValueChange={setSourceVariantId} disabled={isDisabled}>
              <SelectTrigger><SelectValue placeholder="Izaberite..." /></SelectTrigger>
              <SelectContent>
                {articleVariants
                  .filter((v) => (articleVariantStocks.find((s) => s.variant_id === v.id)?.balance_qty ?? 0) > 0)
                  .map((v) => {
                    const qty = articleVariantStocks.find((s) => s.variant_id === v.id)?.balance_qty ?? 0;
                    return (
                      <SelectItem key={v.id} value={v.id}>
                        {v.code} — {v.description} ({formatDecimal(qty, 3)})
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Na stanju: {formatDecimal(sourceVariantStock, 3)}</p>
          </div>
          <div className="space-y-2">
            <Label>Na varijantu (ciljna) *</Label>
            <Select value={targetVariantId} onValueChange={setTargetVariantId} disabled={isDisabled}>
              <SelectTrigger><SelectValue placeholder="Izaberite..." /></SelectTrigger>
              <SelectContent>
                {articleVariants.map((v) => (<SelectItem key={v.id} value={v.id}>{v.code} — {v.description}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Količina *</Label>
            <LocaleNumberInput value={quantityStr} onChange={setQuantityStr} decimalPlaces={3} disabled={isDisabled} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Napomena</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} disabled={isDisabled} />
          </div>
        </div>
      </div>

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Knjiženje zamene varijante</AlertDialogTitle>
            <AlertDialogDescription>Da li ste sigurni da želite da proknjižite ovaj dokument? Ovo je interna magacinska promena bez finansijskog knjiženja.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništavanje knjiženja</AlertDialogTitle>
            <AlertDialogDescription>Da li ste sigurni da želite da poništite knjiženje?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpost}>Poništi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
