import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, BookCheck, Undo2, ArrowLeft, RefreshCw, Save, History,
} from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { ArticleSwap, useArticleSwaps, ArticleSwapFormData } from "@/hooks/useArticleSwaps";
import { useArticles } from "@/hooks/useArticles";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useWarehouseStock } from "@/hooks/useWarehouseStock";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useDocumentLock } from "@/hooks/useDocumentLock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { formatDecimal, parseLocaleNumber } from "@/lib/formatting";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { SearchableArticleSelect, Article } from "@/components/ui/searchable-article-select";

export default function ArticleSwapEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.prijemnice", "write");
  const canPost = hasAccess("robno.prijemnice", "admin");

  const isNew = id === "new";
  const [swap, setSwap] = useState<ArticleSwap | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);

  const { createSwap, updateSwap, postSwap, unpostSwap } = useArticleSwaps();
  const { articles } = useArticles(selectedCompany?.id);
  const { warehouses } = useWarehouses(selectedCompany?.id);
  const activeWarehouses = warehouses.filter((w) => w.is_active);

  // Form state
  const [warehouseId, setWarehouseId] = useState("");
  const [swapDate, setSwapDate] = useState(new Date().toISOString().split("T")[0]);
  const [article1Id, setArticle1Id] = useState("");
  const [quantity1Str, setQuantity1Str] = useState("0,000");
  const [price1Str, setPrice1Str] = useState("0,00");
  const [article2Id, setArticle2Id] = useState("");
  const [quantity2Str, setQuantity2Str] = useState("0,000");
  const [price2Str, setPrice2Str] = useState("0,00");
  const [note, setNote] = useState("");

  // Article details
  const [art1Code, setArt1Code] = useState("");
  const [art1Name, setArt1Name] = useState("");
  const [art1Unit, setArt1Unit] = useState("kom");
  const [art2Code, setArt2Code] = useState("");
  const [art2Name, setArt2Name] = useState("");
  const [art2Unit, setArt2Unit] = useState("kom");

  // Warehouse stock for price lookup
  const { data: warehouseStock } = useWarehouseStock(selectedCompany?.id, warehouseId || undefined, undefined, swapDate);

  const stockMap = useMemo(() => {
    const map = new Map<string, { balance_qty: number; unit_price: number }>();
    if (warehouseStock) {
      for (const row of warehouseStock) {
        if (row.balance_qty > 0) {
          const unitPrice = row.balance_value / row.balance_qty;
          map.set(row.article_id, { balance_qty: row.balance_qty, unit_price: unitPrice });
        }
      }
    }
    return map;
  }, [warehouseStock]);

  // Get selected warehouse to determine SVK filter
  const selectedWarehouse = activeWarehouses.find((w) => w.id === warehouseId);

  // SVK values allowed for a given warehouse type
  const getAllowedSvk = (warehouseType: string | null | undefined): string[] => {
    switch (warehouseType) {
      case "1": return ["1"];
      case "2": return ["2"];
      case "6": return ["6"];
      case "9": return ["9"];
      case "12": return ["1", "2"];
      default: return [];
    }
  };

  const allowedSvk = useMemo(() => getAllowedSvk(selectedWarehouse?.warehouse_type), [selectedWarehouse]);

  // Articles available in warehouse (stock > 0) for Article 1
  const availableArticles = useMemo(() => {
    return articles.filter((a) => a.is_active !== false && stockMap.has(a.id));
  }, [articles, stockMap]);

  // Articles for Article 2: active + matching SVK
  const availableArticles2 = useMemo(() => {
    if (allowedSvk.length === 0) return articles.filter((a) => a.is_active !== false);
    return articles.filter((a) => a.is_active !== false && allowedSvk.includes(a.svk || "1"));
  }, [articles, allowedSvk]);

  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "article_swaps",
    documentId: isNew ? null : id || null,
    initialUpdatedAt: swap?.updated_at || null,
    onConflict: () => fetchSwap(),
  });

  const fetchSwap = async () => {
    if (!id || isNew) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("article_swaps")
      .select(`*, warehouse:warehouses!article_swaps_warehouse_id_fkey(id, code, name, warehouse_type)`)
      .eq("id", id)
      .single();
    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/magacin/zamene");
      return;
    }
    const s = data as unknown as ArticleSwap;
    setSwap(s);
    setWarehouseId(s.warehouse_id);
    setSwapDate(s.swap_date);
    setArticle1Id(s.article_1_id);
    setArt1Code(s.article_1_code);
    setArt1Name(s.article_1_name);
    setArt1Unit(s.article_1_unit);
    setQuantity1Str(formatDecimal(s.quantity_1, 3));
    setPrice1Str(formatDecimal(s.price_1, 2));
    setArticle2Id(s.article_2_id);
    setArt2Code(s.article_2_code);
    setArt2Name(s.article_2_name);
    setArt2Unit(s.article_2_unit);
    setQuantity2Str(formatDecimal(s.quantity_2, 3));
    setPrice2Str(formatDecimal(s.price_2, 2));
    setNote(s.note || "");
    updateLockTimestamp(s.updated_at);
    setIsLoading(false);
  };

  useEffect(() => { if (!isNew) fetchSwap(); }, [id]);

  // Auto-set price_1 from warehouse stock when article_1 changes
  const handleArticle1Select = (articleId: string, article: Article) => {
    setArticle1Id(articleId);
    const fullArticle = articles.find((a) => a.id === articleId);
    if (fullArticle) {
      setArt1Code(fullArticle.code);
      setArt1Name(fullArticle.name);
      setArt1Unit(fullArticle.unit);
      const stock = stockMap.get(articleId);
      const price = stock?.unit_price ?? 0;
      setPrice1Str(formatDecimal(price, 2));
      // Recalculate price_2 if qty2 > 0
      recalcPrice2(price, parseLocaleNumber(quantity1Str), parseLocaleNumber(quantity2Str));
    }
  };

  const handleArticle2Select = (articleId: string, article: Article) => {
    setArticle2Id(articleId);
    const fullArticle = articles.find((a) => a.id === articleId);
    if (fullArticle) {
      setArt2Code(fullArticle.code);
      setArt2Name(fullArticle.name);
      setArt2Unit(fullArticle.unit);
    }
  };

  const recalcPrice2 = (price1: number, qty1: number, qty2: number) => {
    if (qty2 > 0) {
      const newPrice2 = (price1 * qty1) / qty2;
      setPrice2Str(formatDecimal(newPrice2, 2));
    }
  };

  const handleQuantity1Blur = () => {
    const qty1 = parseLocaleNumber(quantity1Str);
    const price1 = parseLocaleNumber(price1Str);
    const qty2 = parseLocaleNumber(quantity2Str);
    recalcPrice2(price1, qty1, qty2);
  };

  const handleQuantity2Blur = () => {
    const qty1 = parseLocaleNumber(quantity1Str);
    const price1 = parseLocaleNumber(price1Str);
    const qty2 = parseLocaleNumber(quantity2Str);
    recalcPrice2(price1, qty1, qty2);
  };

  const handlePrice1Blur = () => {
    const qty1 = parseLocaleNumber(quantity1Str);
    const price1 = parseLocaleNumber(price1Str);
    const qty2 = parseLocaleNumber(quantity2Str);
    recalcPrice2(price1, qty1, qty2);
  };

  // Calculated values
  const quantity1 = parseLocaleNumber(quantity1Str);
  const price1 = parseLocaleNumber(price1Str);
  const quantity2 = parseLocaleNumber(quantity2Str);
  const price2 = parseLocaleNumber(price2Str);
  const swapValue = price1 * quantity1;

  const handleSave = async () => {
    if (!warehouseId || !article1Id || !article2Id || !selectedCompany?.id || !user?.id) {
      toast.error("Popunite sva obavezna polja");
      return;
    }
    if (article1Id === article2Id) {
      toast.error("Artikli moraju biti različiti");
      return;
    }
    if (quantity1 <= 0 || quantity2 <= 0) {
      toast.error("Količine moraju biti veće od 0");
      return;
    }
    // Check stock for article 1
    const stock1 = stockMap.get(article1Id);
    if (stock1 && quantity1 > stock1.balance_qty) {
      toast.error(`Maksimalna količina za artikal 1 je ${formatDecimal(stock1.balance_qty, 3)} (stanje u magacinu)`);
      return;
    }

    const formData: ArticleSwapFormData = {
      warehouse_id: warehouseId,
      swap_date: swapDate,
      article_1_id: article1Id,
      article_1_code: art1Code,
      article_1_name: art1Name,
      article_1_unit: art1Unit,
      quantity_1: quantity1,
      price_1: price1,
      article_2_id: article2Id,
      article_2_code: art2Code,
      article_2_name: art2Name,
      article_2_unit: art2Unit,
      quantity_2: quantity2,
      price_2: price2,
      swap_value: swapValue,
      note: note || null,
    };

    setIsSaving(true);
    try {
      if (isNew) {
        const result = await createSwap.mutateAsync(formData);
        navigate(`/magacin/zamene/${result.id}`, { replace: true });
      } else {
        const canProceed = await checkLock();
        if (!canProceed) return;
        await updateSwap.mutateAsync({ id: id!, ...formData });
        fetchSwap();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePostConfirm = async () => {
    if (!swap) return;
    const canProceed = await checkLock();
    if (!canProceed) return;
    await postSwap.mutateAsync(swap.id);
    setPostDialogOpen(false);
    fetchSwap();
  };

  const handleUnpostConfirm = async () => {
    if (!swap) return;
    await unpostSwap.mutateAsync(swap.id);
    setUnpostDialogOpen(false);
    fetchSwap();
  };

  if (isLoading) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!isNew && !swap) {
    return (
      <MainLayout title="Dokument nije pronađen">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Dokument nije pronađen ili nemate pristup.</p>
          <Button onClick={() => navigate("/magacin/zamene")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isDraft = isNew || swap?.status === "draft";
  const isPosted = swap?.status === "posted";
  const isEditable = isDraft && canEdit;

  return (
    <MainLayout title={isNew ? "Nova zamena artikla" : `Zamena: ${swap?.swap_number}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/magacin/zamene")}>
              <ArrowLeft className="w-4 h-4 mr-2" />Nazad
            </Button>
            <h1 className="text-xl font-semibold">
              {isNew ? "Nova zamena" : swap?.swap_number}
            </h1>
            {!isNew && (
              isPosted ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">Proknjiženo</Badge>
              ) : (
                <Badge variant="outline">Nacrt</Badge>
              )
            )}
          </div>
          {!isNew && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
                <History className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchSwap} title="Osveži">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-lg">
          <div className="space-y-2">
            <Label>Magacin *</Label>
            <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v); setArticle1Id(""); setArticle2Id(""); }} disabled={!isEditable}>
              <SelectTrigger>
                <SelectValue placeholder="Izaberite magacin" />
              </SelectTrigger>
              <SelectContent>
                {activeWarehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>{wh.code} - {wh.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Datum zamene *</Label>
            <LocaleDateInput value={swapDate} onChange={setSwapDate} required disabled={!isEditable} />
          </div>
          <div className="space-y-2">
            <Label>Napomena</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Unesite napomenu..."
              rows={1}
              disabled={!isEditable}
              autoComplete="off"
            />
          </div>
        </div>

        <Separator />

        {/* Article 1 - OUT */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-sm text-destructive">Artikal 1 — Izlaz (storno ulaz)</h3>
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-5">
              <Label>Artikal *</Label>
              <SearchableArticleSelect
                articles={availableArticles}
                value={article1Id}
                onValueChange={handleArticle1Select}
                placeholder="Izaberite artikal..."
                disabled={!isEditable || !warehouseId}
              />
            </div>
            <div className="col-span-1">
              <Label>JM</Label>
              <div className="h-8 flex items-center text-sm text-muted-foreground">{art1Unit || "-"}</div>
            </div>
            <div className="col-span-2">
              <Label>Količina</Label>
              <LocaleNumberInput
                value={quantity1Str}
                onChange={setQuantity1Str}
                onBlur={handleQuantity1Blur}
                decimalPlaces={3}
                disabled={!isEditable}
                className="w-[200px]"
              />
            </div>
            <div className="col-span-2">
              <Label>Cena (mag.)</Label>
              <LocaleNumberInput
                value={price1Str}
                onChange={setPrice1Str}
                onBlur={handlePrice1Blur}
                decimalPlaces={2}
                disabled={!isEditable}
                className="w-[250px]"
              />
            </div>
            <div className="col-span-2">
              <Label>Vrednost</Label>
              <div className="h-8 flex items-center justify-end text-sm font-semibold w-[250px]">
                {formatDecimal(swapValue, 2)}
              </div>
            </div>
          </div>
          {article1Id && stockMap.get(article1Id) && (
            <p className="text-xs text-muted-foreground">
              Stanje u magacinu: {formatDecimal(stockMap.get(article1Id)!.balance_qty, 3)} {art1Unit} 
              (cena: {formatDecimal(stockMap.get(article1Id)!.unit_price, 2)})
            </p>
          )}
        </div>

        {/* Article 2 - IN */}
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-sm text-green-600">Artikal 2 — Ulaz</h3>
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-5">
              <Label>Artikal *</Label>
              <SearchableArticleSelect
                articles={availableArticles2}
                value={article2Id}
                onValueChange={handleArticle2Select}
                placeholder="Izaberite artikal..."
                disabled={!isEditable || !warehouseId}
              />
            </div>
            <div className="col-span-1">
              <Label>JM</Label>
              <div className="h-8 flex items-center text-sm text-muted-foreground">{art2Unit || "-"}</div>
            </div>
            <div className="col-span-2">
              <Label>Količina</Label>
              <LocaleNumberInput
                value={quantity2Str}
                onChange={setQuantity2Str}
                onBlur={handleQuantity2Blur}
                decimalPlaces={3}
                disabled={!isEditable}
                className="w-[200px]"
              />
            </div>
            <div className="col-span-2">
              <Label>Cena (izračunata)</Label>
              <div className="h-8 flex items-center justify-end text-sm font-semibold w-[250px]">
                {formatDecimal(price2, 2)}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Vrednost</Label>
              <div className="h-8 flex items-center justify-end text-sm font-semibold w-[250px]">
                {formatDecimal(quantity2 * price2, 2)}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Cena 2 = Cena 1 × Količina 1 / Količina 2
          </p>
        </div>

        <Separator />

        {/* Summary */}
        <div className="flex gap-6 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <span className="text-muted-foreground">Vrednost zamene: </span>
            <span className="font-bold text-lg">{formatDecimal(swapValue, 2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => navigate("/magacin/zamene")}>Zatvori</Button>
          <div className="flex gap-2">
            {isEditable && (
              <Button onClick={handleSave} disabled={isSaving || !warehouseId || !article1Id || !article2Id}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                {isNew ? "Kreiraj" : "Sačuvaj"}
              </Button>
            )}
            {!isNew && isDraft && canPost && (
              <Button onClick={() => setPostDialogOpen(true)} disabled={swap?.quantity_1 === 0}>
                <BookCheck className="h-4 w-4 mr-2" />Proknjiži
              </Button>
            )}
            {isPosted && canPost && (
              <Button variant="destructive" onClick={() => setUnpostDialogOpen(true)}>
                <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti zamenu?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite zamenu artikla{" "}
              <strong>{swap?.swap_number}</strong>? Ovo će uticati na stanje magacina.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handlePostConfirm}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništiti knjiženje?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje zamene{" "}
              <strong>{swap?.swap_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpostConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Poništi knjiženje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {swap && (
        <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={swap.id} documentName={swap.swap_number} documentType="article_swap" />
      )}
    </MainLayout>
  );
}
