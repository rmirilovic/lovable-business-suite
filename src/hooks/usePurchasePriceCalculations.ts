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
}

export interface CalculationAdditionalCost {
  id: string;
  calculation_id: string;
  company_id: string;
  description: string;
  amount: number;
  distribution_method: "by_value" | "by_quantity";
  item_order: number;
  created_at: string;
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
          goods_receipt:goods_receipts(
            id, receipt_number,
            warehouse:warehouses(id, code, name),
            partner:partners(id, code, name)
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

      // Create calculation header
      const { data: calc, error: calcError } = await (supabase as any)
        .from("purchase_price_calculations")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          goods_receipt_id: goodsReceiptId,
          calculation_number: numberData,
          created_by: user.id,
        })
        .select()
        .single();
      if (calcError) throw calcError;

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
        const calcItems = receiptItems.map((ri: any, idx: number) => ({
          calculation_id: calc.id,
          company_id: selectedCompany.id,
          goods_receipt_item_id: ri.id,
          article_id: ri.article_id,
          item_code: ri.item_code || ri.article?.code || null,
          item_name: ri.item_name,
          unit: ri.unit,
          svk: ri.article?.svk || null,
          quantity: ri.quantity,
          purchase_price: ri.unit_price,
          purchase_value: ri.quantity * ri.unit_price,
          item_order: idx + 1,
        }));

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

      // Update calculation status to posted
      const { error } = await (supabase as any)
        .from("purchase_price_calculations")
        .update({
          status: "posted",
          posted_by: user.id,
          posted_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculations"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-price-calculation"] });
      toast.success("Kalkulacija uspešno proknjižena");
    },
    onError: (error: any) => {
      toast.error(`Greška pri knjiženju: ${error.message}`);
    },
  });

  return {
    calculations: calculationsQuery.data || [],
    isLoading: calculationsQuery.isLoading,
    error: calculationsQuery.error,
    createFromReceipt,
    deleteCalculation,
    postCalculation,
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
          goods_receipt:goods_receipts(
            id, receipt_number, receipt_date,
            warehouse:warehouses(id, code, name),
            partner:partners(id, code, name)
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

    // Preserve existing markup percent
    const markupAmount = Math.round(costPrice * item.markup_percent) / 100;
    const sellingPrice = costPrice + markupAmount;
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
