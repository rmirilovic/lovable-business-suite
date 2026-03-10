import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { useWarehouses } from "@/hooks/useWarehouses";
import { usePartners } from "@/hooks/usePartners";
import { supabase } from "@/integrations/supabase/client";
import { DeliveryOrder } from "@/hooks/useDeliveryOrders";
import { toast } from "sonner";

interface QuoteOption {
  id: string;
  quote_number: string;
  partner_id: string;
  partner_name: string | null;
  quote_date: string;
  total_amount: number;
}

interface QuoteItemForOrder {
  article_id: string;
  item_code: string;
  item_name: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface DeliveryOrderHeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: DeliveryOrder | null;
  onSave: (data: any) => void;
  isLoading?: boolean;
}

export function DeliveryOrderHeaderDialog({ open, onOpenChange, order, onSave, isLoading }: DeliveryOrderHeaderDialogProps) {
  const { selectedCompany, selectedYear, user } = useAuth();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const { warehouses } = useWarehouses(selectedCompany?.id);
  const { partners } = usePartners();
  const activeWarehouses = warehouses.filter((w) => w.is_active);

  const [formData, setFormData] = useState({
    order_date: new Date().toISOString().split("T")[0],
    delivery_deadline: "",
    partner_id: "",
    delivery_address: "",
    delivery_method: "",
    warehouse_id: "",
    payment_method: "",
    contact_person: "",
    ordered_by: "",
    note: "",
    composed_by: "",
  });

  const [approvedQuotes, setApprovedQuotes] = useState<QuoteOption[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [quoteItems, setQuoteItems] = useState<QuoteItemForOrder[]>([]);
  const isNew = !order;

  // Load approved quotes when dialog opens for new order
  useEffect(() => {
    if (!open || !isNew || !selectedCompany || !selectedYear) return;
    const loadQuotes = async () => {
      const { data } = await supabase
        .from("quotes")
        .select("id, quote_number, partner_id, partner_name, quote_date, total_amount")
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .eq("status", "approved")
        .order("quote_number", { ascending: false });
      setApprovedQuotes(data || []);
    };
    loadQuotes();
  }, [open, isNew, selectedCompany?.id, selectedYear?.id]);

  useEffect(() => {
    if (open) {
      if (order) {
        setFormData({
          order_date: order.order_date,
          delivery_deadline: order.delivery_deadline || "",
          partner_id: order.partner_id,
          delivery_address: order.delivery_address || "",
          delivery_method: order.delivery_method || "",
          warehouse_id: order.warehouse_id || "",
          payment_method: order.payment_method || "",
          contact_person: order.contact_person || "",
          ordered_by: order.ordered_by || "",
          note: order.note || "",
          composed_by: order.composed_by || "",
        });
        setSelectedQuoteId("");
        setQuoteItems([]);
      } else {
        const loadProfile = async () => {
          if (!user) return;
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();
          if (profile) {
            setFormData((prev) => ({
              ...prev,
              composed_by: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
            }));
          }
        };
        loadProfile();
        setFormData((prev) => ({
          ...prev,
          order_date: new Date().toISOString().split("T")[0],
          delivery_deadline: "",
          partner_id: "",
          delivery_address: "",
          delivery_method: "",
          warehouse_id: "",
          payment_method: "",
          contact_person: "",
          ordered_by: "",
          note: "",
        }));
        setSelectedQuoteId("");
        setQuoteItems([]);
      }
    }
  }, [open, order, user]);

  // When a quote is selected, load its data
  const handleQuoteSelect = async (quoteId: string) => {
    setSelectedQuoteId(quoteId);
    if (!quoteId) {
      setQuoteItems([]);
      return;
    }

    // Load the quote with partner info
    const { data: quote } = await supabase
      .from("quotes")
      .select("partner_id")
      .eq("id", quoteId)
      .single();

    if (!quote) return;

    // Set partner
    const partner = partners.find((p) => p.id === quote.partner_id);
    const addr = partner ? [partner.address, partner.postal_code, partner.city].filter(Boolean).join(", ") : "";

    // Find warehouse with code "06" (GP)
    const gpWarehouse = activeWarehouses.find((w) => w.code === "06");

    setFormData((prev) => ({
      ...prev,
      partner_id: quote.partner_id,
      delivery_address: addr,
      warehouse_id: gpWarehouse?.id || prev.warehouse_id,
    }));

    // Load quote items - only gotovi proizvodi (SVK = 9)
    const { data: items } = await supabase
      .from("quote_items")
      .select("article_id, item_code, item_name, description, unit, quantity, unit_price, line_subtotal")
      .eq("quote_id", quoteId)
      .order("item_order");

    if (!items || items.length === 0) {
      toast.info("Ponuda nema stavki");
      setQuoteItems([]);
      return;
    }

    // Filter only articles with SVK = 9 (gotovi proizvodi)
    const articleIds = items.filter((i) => i.article_id).map((i) => i.article_id!);
    let svkMap: Record<string, string | null> = {};
    if (articleIds.length > 0) {
      const { data: articles } = await supabase
        .from("articles")
        .select("id, svk")
        .in("id", articleIds);
      if (articles) {
        articles.forEach((a) => { svkMap[a.id] = a.svk; });
      }
    }

    const gpItems: QuoteItemForOrder[] = items
      .filter((i) => i.article_id && svkMap[i.article_id!] === "9")
      .map((i) => ({
        article_id: i.article_id!,
        item_code: i.item_code || "",
        item_name: i.item_name,
        description: i.description || "",
        unit: i.unit,
        quantity: i.quantity,
        unit_price: i.unit_price,
        line_total: i.quantity * i.unit_price,
      }));

    if (gpItems.length === 0) {
      toast.info("Ponuda nema artikala gotovih proizvoda (SVK=9)");
    } else {
      toast.success(`Učitano ${gpItems.length} stavki gotovih proizvoda iz ponude`);
    }
    setQuoteItems(gpItems);
  };

  // Auto-fill delivery address from partner (only if not from quote)
  useEffect(() => {
    if (formData.partner_id && !order && !selectedQuoteId) {
      const partner = partners.find((p) => p.id === formData.partner_id);
      if (partner) {
        const addr = [partner.address, partner.postal_code, partner.city].filter(Boolean).join(", ");
        setFormData((prev) => ({ ...prev, delivery_address: addr }));
      }
    }
  }, [formData.partner_id, partners, order, selectedQuoteId]);

  const handleSubmit = () => {
    if (!formData.partner_id) return;
    onSave({
      ...formData,
      source_quote_id: selectedQuoteId || null,
      quoteItems: quoteItems.length > 0 ? quoteItems : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? "Uredi zaglavlje naloga" : "Novi nalog za isporuku"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Quote selector - only for new orders */}
          {isNew && approvedQuotes.length > 0 && (
            <div className="col-span-2 space-y-1">
              <Label>Učitaj iz odobrene ponude</Label>
              <Select value={selectedQuoteId} onValueChange={handleQuoteSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite ponudu (opciono)" />
                </SelectTrigger>
                <SelectContent>
                  {approvedQuotes.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.quote_number} - {q.partner_name || "Nepoznat partner"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label>Datum naloga *</Label>
            <LocaleDateInput value={formData.order_date} onChange={(v) => setFormData((p) => ({ ...p, order_date: v }))} minDate={minDate} maxDate={maxDate} />
          </div>
          <div className="space-y-1">
            <Label>Rok isporuke</Label>
            <LocaleDateInput value={formData.delivery_deadline} onChange={(v) => setFormData((p) => ({ ...p, delivery_deadline: v }))} />
          </div>
          <div className="space-y-1">
            <Label>Kupac *</Label>
            <SearchablePartnerSelect
              partners={partners.filter((p) => p.is_active)}
              value={formData.partner_id}
              onValueChange={(v) => setFormData((p) => ({ ...p, partner_id: v }))}
              placeholder="Izaberite kupca"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Adresa za isporuku</Label>
            <Input
              value={formData.delivery_address}
              onChange={(e) => setFormData((p) => ({ ...p, delivery_address: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label>Način isporuke</Label>
            <Input
              value={formData.delivery_method}
              onChange={(e) => setFormData((p) => ({ ...p, delivery_method: e.target.value }))}
              placeholder="npr. Sopstveni transport"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label>Magacin</Label>
            <Select value={formData.warehouse_id} onValueChange={(v) => setFormData((p) => ({ ...p, warehouse_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Izaberite magacin" />
              </SelectTrigger>
              <SelectContent>
                {activeWarehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.code} - {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Način plaćanja</Label>
            <Input
              value={formData.payment_method}
              onChange={(e) => setFormData((p) => ({ ...p, payment_method: e.target.value }))}
              placeholder="npr. Virman 30 dana"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label>Kontakt osoba</Label>
            <Input
              value={formData.contact_person}
              onChange={(e) => setFormData((p) => ({ ...p, contact_person: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label>Robu poručio</Label>
            <Input
              value={formData.ordered_by}
              onChange={(e) => setFormData((p) => ({ ...p, ordered_by: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label>Kreirao dokument</Label>
            <Input
              value={formData.composed_by}
              onChange={(e) => setFormData((p) => ({ ...p, composed_by: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Napomena</Label>
            <Textarea
              value={formData.note}
              onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Otkaži</Button>
          <Button onClick={handleSubmit} disabled={!formData.partner_id || isLoading}>
            {isLoading ? "Čuvanje..." : "Sačuvaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
