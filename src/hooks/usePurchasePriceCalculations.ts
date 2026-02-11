import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────

export interface PurchasePriceCalculation {
  id: string;
  company_id: string;
  business_year_id: string;
  goods_receipt_id: string;
  source_goods_invoice_id: string | null;
  calculation_number: string;
  calculation_date: string;
  status: "draft" | "posted";
  total_purchase_value: number;
  total_additional_costs: number;
  total_cost_value: number;
  total_markup_value: number;
  total_selling_value: number;
  note: string | null;
  created_by: string;
  posted_by: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
  goods_receipt?: {
    id: string;
    receipt_number: string;
    warehouse: { id: string; code: string; name: string } | null;
    partner: { id: string; code: string; name: string } | null;
  };
  source_goods_invoice?: {
    id: string;
    internal_number: string;
    supplier_invoice_number: string;
  } | null;
}

export interface CalculationAdditionalCost {
  id: string;
  calculation_id: string;
  company_id: string;
  description: string;
  amount: number;
  distribution_method: "by_value" | "by_quantity";
  partner_id: string | null;
  source_ufu_id: string | null;
  source_ufu_item_id: string | null;
  item_order: number;
  created_at: string;
}

export interface CalculationUfuLink {
  id: string;
  calculation_id: string;
  service_invoice_id: string;
  company_id: string;
  created_at: string;
  service_invoice?: {
    id: string;
    internal_number: string;
    supplier_invoice_number: string;
    total_amount: number;
    partner: { id: string; code: string; name: string } | null;
  };
}

export interface CalculationItem {
  id: string;
  calculation_id: string;
  company_id: string;
  goods_receipt_item_id: string | null;
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  unit: string;
  svk: string | null;
  quantity: number;
  purchase_price: number;
  purchase_value: number;
  allocated_costs: number;
  cost_price: number;
  cost_value: number;
  markup_percent: number;
  markup_amount: number;
  selling_price: number;
  selling_value: number;
  item_order: number;
  created_at: string;
}

// ─── List Hook ───────────────────────────────────────────────────────

export function usePurchasePriceCalculations() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const calculationsQuery = useQuery({
    queryKey: ["purchase-price-calculations", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const { data, error } = await (supabase as any)
        .from("purchase_price_calculations")
        .select(`
          *,
          goods_receipt:goods_receipts!purchase_price_calculations_goods_receipt_id_fkey(
            id, receipt_number,
            warehouse:warehouses(id, code, name),
            partner:partners(id, code, name)
          ),
          source_goods_invoice:goods_purchase_invoices!purchase_price_calculations_source_goods_invoice_id_fkey(
            id, internal_number, supplier_invoice_number
          )
        `)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("calculation_number", { ascending: false });

      if (error) throw error;
      return data as PurchasePriceCalculation[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createFromReceipt = useMutation({
    mutationFn: async (goodsReceiptId: string) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Potrebno je izabrati firmu i godinu");
      }

      // Get next calculation number
      const { data: numberData, error: numberError } = await supabase.rpc(
        "get_next_calculation_number" as any,
        { _company_id: selectedCompany.id, _year_id: selectedYear.id }
      );
      if (numberError) throw numberError;

      // Fetch the receipt to get source_invoice_id
      const { data: receipt, error: receiptError } = await supabase
        .from("goods_receipts")
        .select("source_invoice_id")
        .eq("id", goodsReceiptId)
        .single();
      if (receiptError) throw receiptError;

      const sourceInvoiceId = receipt?.source_invoice_id || null;

      // Create calculation header with UFR already linked
      const { data: calc, error: calcError } = await (supabase as any)
        .from("purchase_price_calculations")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          goods_receipt_id: goodsReceiptId,
          source_goods_invoice_id: sourceInvoiceId,
          calculation_number: numberData,
          created_by: user.id,
        })
        .select()
        .single();
      if (calcError) throw calcError;

      // Link receipt to calculation
      await (supabase as any)
        .from("goods_receipts")
        .update({ linked_calculation_id: calc.id })
        .eq("id", goodsReceiptId);

      // Mark UFR as linked to this calculation
      if (sourceInvoiceId) {
        await (supabase as any)
          .from("goods_purchase_invoices")
          .update({ linked_calculation_id: calc.id })
          .eq("id", sourceInvoiceId);
      }

      // Build a map of UFR item net prices by article_id
      let ufrPriceMap: Record<string, number> = {};
      if (sourceInvoiceId) {
        const { data: ufrItems } = await (supabase as any)
          .from("goods_purchase_invoice_items")
          .select("article_id, unit_price, discount_percent, line_subtotal, quantity")
          .eq("goods_purchase_invoice_id", sourceInvoiceId);

        if (ufrItems) {
          for (const ui of ufrItems) {
            if (!ui.article_id) continue;
            const netPrice = ui.quantity > 0 ? ui.line_subtotal / ui.quantity : ui.unit_price;
            ufrPriceMap[ui.article_id] = Math.round(netPrice * 100) / 100;
          }
        }
      }

      // Fetch receipt items to populate calculation items
      const { data: receiptItems, error: riError } = await supabase
        .from("goods_receipt_items")
        .select(`
          *,
          article:articles(id, code, name, unit, svk)
        `)
        .eq("goods_receipt_id", goodsReceiptId)
        .order("item_order");
      if (riError) throw riError;

      if (receiptItems && receiptItems.length > 0) {
        const calcItems = receiptItems.map((ri: any, idx: number) => {
          // Use UFR net price if available, otherwise receipt price
          const purchasePrice = (ri.article_id && ufrPriceMap[ri.article_id] !== undefined)
            ? ufrPriceMap[ri.article_id]
            : ri.unit_price;
          const purchaseValue = Math.round(ri.quantity * purchasePrice * 100) / 100;
          return {
            calculation_id: calc.id,
            company_id: selectedCompany.id,
            goods_receipt_item_id: ri.id,
            article_id: ri.article_id,
            item_code: ri.item_code || ri.article?.code || null,
            item_name: ri.item_name,
            unit: ri.unit,
            svk: ri.article?.svk || null,
            quantity: ri.quantity,
            purchase_price: purchasePrice,
            purchase_value: purchaseValue,
            cost_price: purchasePrice,
            cost_value: purchaseValue,
            item_order: idx + 1,
          };
        });

        const { error: itemsError } = await (supabase as any)
          .from("calculation_items")
          .insert(calcItems);
        if (itemsError) throw itemsError;

        // Update header totals
        const totalPurchaseValue = calcItems.reduce(
          (sum: number, i: any) => sum + i.purchase_value, 0
        );
        await (supabase as any)
          .from("purchase_price_calculations")
          .update({ total_purchase_value: totalPurchaseValue })
          .eq("id", calc.id);
      }

      return calc as PurchasePriceCalculation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculations"] });
      toast.success("Kalkulacija uspešno kreirana");
    },
    onError: (error: any) => {
      if (error.message?.includes("idx_unique_calc_per_receipt")) {
        toast.error("Kalkulacija za ovu prijemnicu već postoji");
      } else {
        toast.error(`Greška pri kreiranju: ${error.message}`);
      }
    },
  });

  const deleteCalculation = useMutation({
    mutationFn: async (id: string) => {
      // Unlink receipt
      await (supabase as any)
        .from("goods_receipts")
        .update({ linked_calculation_id: null })
        .eq("linked_calculation_id", id);
      // Unlink UFR
      await (supabase as any)
        .from("goods_purchase_invoices")
        .update({ linked_calculation_id: null })
        .eq("linked_calculation_id", id);
      // UFU links are cascade deleted
      // Delete calculation (items + costs cascade)
      const { error } = await (supabase as any)
        .from("purchase_price_calculations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculations"] });
      toast.success("Kalkulacija obrisana");
    },
    onError: (error: any) => {
      toast.error(`Greška pri brisanju: ${error.message}`);
    },
  });

  const postCalculation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Korisnik nije prijavljen");

      const { data, error } = await supabase.rpc(
        "post_purchase_price_calculation" as any,
        { _calculation_id: id, _user_id: user.id }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculations"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["calculation-items"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      toast.success("Kalkulacija uspešno proknjižena");
    },
    onError: (error: any) => {
      toast.error(`Greška pri knjiženju: ${error.message}`);
    },
  });

  const unpostCalculation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Korisnik nije prijavljen");

      const { data, error } = await supabase.rpc(
        "unpost_purchase_price_calculation" as any,
        { _calculation_id: id, _user_id: user.id }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculations"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculation"] });
      queryClient.invalidateQueries({ queryKey: ["calculation-items"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-stock"] });
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      toast.success("Knjiženje kalkulacije poništeno");
    },
    onError: (error: any) => {
      toast.error(`Greška pri poništavanju: ${error.message}`);
    },
  });

  return {
    calculations: calculationsQuery.data || [],
    isLoading: calculationsQuery.isLoading,
    error: calculationsQuery.error,
    createFromReceipt,
    deleteCalculation,
    postCalculation,
    unpostCalculation,
  };
}

// ─── Detail Hook ─────────────────────────────────────────────────────

export function useCalculationDetail(calculationId: string | undefined) {
  const query = useQuery({
    queryKey: ["purchase-price-calculation", calculationId],
    queryFn: async () => {
      if (!calculationId) return null;

      const { data, error } = await (supabase as any)
        .from("purchase_price_calculations")
        .select(`
          *,
          goods_receipt:goods_receipts!purchase_price_calculations_goods_receipt_id_fkey(
            id, receipt_number, receipt_date,
            warehouse:warehouses(id, code, name),
            partner:partners(id, code, name)
          ),
          source_goods_invoice:goods_purchase_invoices!purchase_price_calculations_source_goods_invoice_id_fkey(
            id, internal_number, supplier_invoice_number
          )
        `)
        .eq("id", calculationId)
        .single();
      if (error) throw error;
      return data as PurchasePriceCalculation;
    },
    enabled: !!calculationId,
  });

  return {
    calculation: query.data || null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ─── Additional Costs Hook ───────────────────────────────────────────

export function useCalculationCosts(calculationId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const costsQuery = useQuery({
    queryKey: ["calculation-costs", calculationId],
    queryFn: async () => {
      if (!calculationId) return [];
      const { data, error } = await (supabase as any)
        .from("calculation_additional_costs")
        .select("*")
        .eq("calculation_id", calculationId)
        .order("item_order");
      if (error) throw error;
      return data as CalculationAdditionalCost[];
    },
    enabled: !!calculationId,
  });

  const addCost = useMutation({
    mutationFn: async (cost: {
      description: string;
      amount: number;
      distribution_method: "by_value" | "by_quantity";
      partner_id?: string | null;
    }) => {
      if (!calculationId || !selectedCompany?.id) throw new Error("Nedostaju podaci");

      const { data: existing } = await (supabase as any)
        .from("calculation_additional_costs")
        .select("item_order")
        .eq("calculation_id", calculationId)
        .order("item_order", { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.item_order || 0) + 1;

      const { data, error } = await (supabase as any)
        .from("calculation_additional_costs")
        .insert({
          calculation_id: calculationId,
          company_id: selectedCompany.id,
          item_order: nextOrder,
          ...cost,
        })
        .select()
        .single();
      if (error) throw error;
      return data as CalculationAdditionalCost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculation-costs", calculationId] });
    },
    onError: (error: any) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const updateCost = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; description?: string; amount?: number; distribution_method?: string }) => {
      const { error } = await (supabase as any)
        .from("calculation_additional_costs")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculation-costs", calculationId] });
    },
    onError: (error: any) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const deleteCost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("calculation_additional_costs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculation-costs", calculationId] });
    },
    onError: (error: any) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  return {
    costs: costsQuery.data || [],
    isLoading: costsQuery.isLoading,
    addCost,
    updateCost,
    deleteCost,
  };
}

// ─── Calculation Items Hook ──────────────────────────────────────────

export function useCalculationItems(calculationId: string | null) {
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["calculation-items", calculationId],
    queryFn: async () => {
      if (!calculationId) return [];
      const { data, error } = await (supabase as any)
        .from("calculation_items")
        .select("*")
        .eq("calculation_id", calculationId)
        .order("item_order");
      if (error) throw error;
      return data as CalculationItem[];
    },
    enabled: !!calculationId,
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CalculationItem> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("calculation_items")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculation-items", calculationId] });
    },
    onError: (error: any) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const batchUpdateItems = useMutation({
    mutationFn: async (updates: Array<{ id: string; [key: string]: any }>) => {
      for (const { id, ...data } of updates) {
        const { error } = await (supabase as any)
          .from("calculation_items")
          .update(data)
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculation-items", calculationId] });
    },
    onError: (error: any) => {
      toast.error(`Greška pri ažuriranju stavki: ${error.message}`);
    },
  });

  const updateCalculationTotals = useMutation({
    mutationFn: async (totals: {
      total_purchase_value: number;
      total_additional_costs: number;
      total_cost_value: number;
      total_markup_value: number;
      total_selling_value: number;
    }) => {
      if (!calculationId) return;
      const { error } = await (supabase as any)
        .from("purchase_price_calculations")
        .update(totals)
        .eq("id", calculationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculation", calculationId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculations"] });
    },
  });

  return {
    items: itemsQuery.data || [],
    isLoading: itemsQuery.isLoading,
    updateItem,
    batchUpdateItems,
    updateCalculationTotals,
  };
}

// ─── Cost Distribution Logic ─────────────────────────────────────────

export function distributeAdditionalCosts(
  items: CalculationItem[],
  costs: CalculationAdditionalCost[]
): Array<{ id: string; allocated_costs: number; cost_price: number; cost_value: number; selling_price: number; selling_value: number; markup_amount: number }> {
  const totalPurchaseValue = items.reduce((s, i) => s + i.purchase_value, 0);
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);

  return items.map((item) => {
    let allocated = 0;

    for (const cost of costs) {
      if (cost.distribution_method === "by_value" && totalPurchaseValue > 0) {
        allocated += (item.purchase_value / totalPurchaseValue) * cost.amount;
      } else if (cost.distribution_method === "by_quantity" && totalQuantity > 0) {
        allocated += (item.quantity / totalQuantity) * cost.amount;
      }
    }

    // Round to 2 decimals
    allocated = Math.round(allocated * 100) / 100;

    const costValue = item.purchase_value + allocated;
    const costPrice = item.quantity > 0 ? costValue / item.quantity : 0;

    // Preserve existing markup percent (stored with 6 decimal precision)
    const markupAmount = Math.round(costPrice * item.markup_percent * 100) / 10000;
    const sellingPrice = Math.round((costPrice + markupAmount) * 100) / 100;
    const sellingValue = Math.round(sellingPrice * item.quantity * 100) / 100;

    return {
      id: item.id,
      allocated_costs: allocated,
      cost_price: Math.round(costPrice * 100) / 100,
      cost_value: Math.round(costValue * 100) / 100,
      markup_amount: Math.round(markupAmount * 100) / 100,
      selling_price: Math.round(sellingPrice * 100) / 100,
      selling_value: sellingValue,
    };
  });
}

// ─── Check if calculation exists for receipt ─────────────────────────

export function useExistingCalculation(goodsReceiptId: string | null) {
  return useQuery({
    queryKey: ["existing-calculation", goodsReceiptId],
    queryFn: async () => {
      if (!goodsReceiptId) return null;
      const { data, error } = await (supabase as any)
        .from("purchase_price_calculations")
        .select("id, calculation_number, status")
        .eq("goods_receipt_id", goodsReceiptId)
        .neq("status", "cancelled")
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; calculation_number: string; status: string } | null;
    },
    enabled: !!goodsReceiptId,
  });
}

// ─── UFR Linking Hook ────────────────────────────────────────────────

export function useCalculationUfrLink(calculationId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  // Get available UFR documents (posted, same supplier/warehouse, not linked)
  const availableUfr = useQuery({
    queryKey: ["available-ufr", calculationId],
    queryFn: async () => {
      if (!calculationId || !selectedCompany?.id) return [];

      // Get the calculation's receipt to know supplier and warehouse
      const { data: calc } = await (supabase as any)
        .from("purchase_price_calculations")
        .select(`
          goods_receipt:goods_receipts!purchase_price_calculations_goods_receipt_id_fkey(partner_id, warehouse_id)
        `)
        .eq("id", calculationId)
        .single();

      if (!calc?.goods_receipt) return [];

      const { partner_id, warehouse_id } = calc.goods_receipt;

      const { data, error } = await (supabase as any)
        .from("goods_purchase_invoices")
        .select("id, internal_number, supplier_invoice_number, total_amount, subtotal, linked_calculation_id")
        .eq("company_id", selectedCompany.id)
        .eq("status", "posted")
        .eq("partner_id", partner_id)
        .eq("warehouse_id", warehouse_id)
        .is("linked_calculation_id", null)
        .order("internal_number", { ascending: false });

      if (error) throw error;
      return data as Array<{
        id: string;
        internal_number: string;
        supplier_invoice_number: string;
        total_amount: number;
        subtotal: number;
      }>;
    },
    enabled: !!calculationId && !!selectedCompany?.id,
  });

  const linkUfr = useMutation({
    mutationFn: async (ufrId: string) => {
      if (!calculationId) throw new Error("Nema kalkulacije");

      // Link UFR to calculation
      await (supabase as any)
        .from("purchase_price_calculations")
        .update({ source_goods_invoice_id: ufrId })
        .eq("id", calculationId);

      // Mark UFR as linked
      await (supabase as any)
        .from("goods_purchase_invoices")
        .update({ linked_calculation_id: calculationId })
        .eq("id", ufrId);

      // Update calculation items with purchase prices from UFR items
      const { data: ufrItems } = await (supabase as any)
        .from("goods_purchase_invoice_items")
        .select("article_id, unit_price, discount_percent, line_subtotal, quantity")
        .eq("goods_purchase_invoice_id", ufrId);

      if (ufrItems) {
        for (const ufrItem of ufrItems) {
          if (!ufrItem.article_id) continue;
          // Net price = line_subtotal / quantity (after discount)
          const netPrice = ufrItem.quantity > 0 ? ufrItem.line_subtotal / ufrItem.quantity : ufrItem.unit_price;
          const { data: calcItems } = await (supabase as any)
            .from("calculation_items")
            .select("id, quantity")
            .eq("calculation_id", calculationId)
            .eq("article_id", ufrItem.article_id);

          if (calcItems) {
            for (const ci of calcItems) {
              await (supabase as any)
                .from("calculation_items")
                .update({
                  purchase_price: Math.round(netPrice * 100) / 100,
                  purchase_value: Math.round(netPrice * ci.quantity * 100) / 100,
                })
                .eq("id", ci.id);
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculation", calculationId] });
      queryClient.invalidateQueries({ queryKey: ["calculation-items", calculationId] });
      queryClient.invalidateQueries({ queryKey: ["available-ufr", calculationId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculations"] });
      toast.success("UFR povezana sa kalkulacijom");
    },
    onError: (error: any) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const unlinkUfr = useMutation({
    mutationFn: async (ufrId: string) => {
      if (!calculationId) throw new Error("Nema kalkulacije");

      await (supabase as any)
        .from("purchase_price_calculations")
        .update({ source_goods_invoice_id: null })
        .eq("id", calculationId);

      await (supabase as any)
        .from("goods_purchase_invoices")
        .update({ linked_calculation_id: null })
        .eq("id", ufrId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculation", calculationId] });
      queryClient.invalidateQueries({ queryKey: ["available-ufr", calculationId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculations"] });
      toast.success("UFR odvezana od kalkulacije");
    },
    onError: (error: any) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  return {
    availableUfr: availableUfr.data || [],
    isLoadingUfr: availableUfr.isLoading,
    linkUfr,
    unlinkUfr,
  };
}

// ─── UFU Linking Hook ────────────────────────────────────────────────

export function useCalculationUfuLinks(calculationId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  // Get linked UFU documents
  const linkedUfu = useQuery({
    queryKey: ["calculation-ufu-links", calculationId],
    queryFn: async () => {
      if (!calculationId) return [];
      const { data, error } = await (supabase as any)
        .from("calculation_ufu_links")
        .select(`
          *,
          service_invoice:service_purchase_invoices(
            id, internal_number, supplier_invoice_number, total_amount,
            partner:partners(id, code, name)
          )
        `)
        .eq("calculation_id", calculationId);
      if (error) throw error;
      return data as CalculationUfuLink[];
    },
    enabled: !!calculationId,
  });

  // Get available UFU documents (posted, not linked, with procurement cost accounts)
  const availableUfu = useQuery({
    queryKey: ["available-ufu", calculationId, selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      // Get procurement cost account codes
      const { data: procAccounts } = await supabase
        .from("chart_of_accounts")
        .select("code")
        .eq("company_id", selectedCompany.id)
        .eq("is_procurement_cost", true as any);

      const procCodes = (procAccounts || []).map((a: any) => a.code);
      if (procCodes.length === 0) return [];

      // Get input costs that use procurement cost accounts
      const { data: inputCosts } = await supabase
        .from("input_costs")
        .select("id")
        .eq("company_id", selectedCompany.id)
        .in("account_code", procCodes);

      const inputCostIds = (inputCosts || []).map((ic: any) => ic.id);
      if (inputCostIds.length === 0) return [];

      // Find posted UFU that have items with these input costs and are not linked
      const { data: ufuItems } = await (supabase as any)
        .from("service_purchase_invoice_items")
        .select("service_purchase_invoice_id")
        .in("input_cost_id", inputCostIds);

      const ufuIds = [...new Set((ufuItems || []).map((i: any) => i.service_purchase_invoice_id))];
      if (ufuIds.length === 0) return [];

      // Filter: posted, not already linked
      const { data: linkedIds } = await (supabase as any)
        .from("calculation_ufu_links")
        .select("service_invoice_id");

      const alreadyLinked = new Set((linkedIds || []).map((l: any) => l.service_invoice_id));
      const availableIds = ufuIds.filter((id: string) => !alreadyLinked.has(id));

      if (availableIds.length === 0) return [];

      const { data, error } = await (supabase as any)
        .from("service_purchase_invoices")
        .select("id, internal_number, supplier_invoice_number, total_amount, partner:partners(id, code, name)")
        .eq("company_id", selectedCompany.id)
        .eq("status", "posted")
        .in("id", availableIds)
        .order("internal_number", { ascending: false });

      if (error) throw error;
      return data as Array<{
        id: string;
        internal_number: string;
        supplier_invoice_number: string;
        total_amount: number;
        partner: { id: string; code: string; name: string } | null;
      }>;
    },
    enabled: !!selectedCompany?.id,
  });

  const linkUfu = useMutation({
    mutationFn: async (serviceInvoiceId: string) => {
      if (!calculationId || !selectedCompany?.id) throw new Error("Nedostaju podaci");

      // Create link
      await (supabase as any)
        .from("calculation_ufu_links")
        .insert({
          calculation_id: calculationId,
          service_invoice_id: serviceInvoiceId,
          company_id: selectedCompany.id,
        });

      // Get procurement cost account codes
      const { data: procAccounts } = await supabase
        .from("chart_of_accounts")
        .select("code")
        .eq("company_id", selectedCompany.id)
        .eq("is_procurement_cost", true as any);

      const procCodes = new Set((procAccounts || []).map((a: any) => a.code));

      // Load UFU items that are procurement costs
      const { data: ufuItems } = await (supabase as any)
        .from("service_purchase_invoice_items")
        .select(`
          *,
          input_cost:input_costs(id, account_code, name)
        `)
        .eq("service_purchase_invoice_id", serviceInvoiceId);

      // Get UFU partner
      const { data: ufu } = await (supabase as any)
        .from("service_purchase_invoices")
        .select("partner_id")
        .eq("id", serviceInvoiceId)
        .single();

      // Get existing max order
      const { data: existing } = await (supabase as any)
        .from("calculation_additional_costs")
        .select("item_order")
        .eq("calculation_id", calculationId)
        .order("item_order", { ascending: false })
        .limit(1);

      let nextOrder = (existing?.[0]?.item_order || 0) + 1;

      // Insert each qualifying UFU item as an additional cost
      for (const item of (ufuItems || [])) {
        if (!item.input_cost || !procCodes.has(item.input_cost.account_code)) continue;

        // Amount = line_subtotal (neto iznos troška)
        const amount = item.line_subtotal;

        await (supabase as any)
          .from("calculation_additional_costs")
          .insert({
            calculation_id: calculationId,
            company_id: selectedCompany.id,
            description: item.item_name,
            amount: amount,
            distribution_method: "by_value",
            partner_id: ufu?.partner_id || null,
            source_ufu_id: serviceInvoiceId,
            source_ufu_item_id: item.id,
            item_order: nextOrder++,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculation-ufu-links", calculationId] });
      queryClient.invalidateQueries({ queryKey: ["calculation-costs", calculationId] });
      queryClient.invalidateQueries({ queryKey: ["available-ufu"] });
      toast.success("UFU troškovi učitani u kalkulaciju");
    },
    onError: (error: any) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const unlinkUfu = useMutation({
    mutationFn: async (serviceInvoiceId: string) => {
      if (!calculationId) throw new Error("Nema kalkulacije");

      // Remove costs from this UFU
      await (supabase as any)
        .from("calculation_additional_costs")
        .delete()
        .eq("calculation_id", calculationId)
        .eq("source_ufu_id", serviceInvoiceId);

      // Remove link
      await (supabase as any)
        .from("calculation_ufu_links")
        .delete()
        .eq("calculation_id", calculationId)
        .eq("service_invoice_id", serviceInvoiceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calculation-ufu-links", calculationId] });
      queryClient.invalidateQueries({ queryKey: ["calculation-costs", calculationId] });
      queryClient.invalidateQueries({ queryKey: ["available-ufu"] });
      toast.success("UFU odvezana od kalkulacije");
    },
    onError: (error: any) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  return {
    linkedUfu: linkedUfu.data || [],
    availableUfu: availableUfu.data || [],
    isLoadingLinked: linkedUfu.isLoading,
    isLoadingAvailable: availableUfu.isLoading,
    linkUfu,
    unlinkUfu,
  };
}
