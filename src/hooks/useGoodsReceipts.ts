import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface GoodsReceipt {
  id: string;
  company_id: string;
  business_year_id: string;
  warehouse_id: string;
  partner_id: string | null;
  receipt_number: string;
  receipt_date: string;
  source_invoice_id: string | null;
  status: "draft" | "posted";
  note: string | null;
  created_by: string;
  posted_at: string | null;
  posted_by: string | null;
  created_at: string;
  updated_at: string;
  warehouse?: {
    id: string;
    code: string;
    name: string;
  };
  partner?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface GoodsReceiptItem {
  id: string;
  goods_receipt_id: string;
  company_id: string;
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  item_order: number;
  created_at: string;
  article?: {
    id: string;
    code: string;
    name: string;
    unit: string;
  };
}

export interface GoodsReceiptFormData {
  warehouse_id: string;
  partner_id: string | null;
  receipt_date: string;
  note: string | null;
}

export interface GoodsReceiptItemFormData {
  article_id: string | null;
  item_code: string | null;
  item_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

export function useGoodsReceipts() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();

  const receiptsQuery = useQuery({
    queryKey: ["goods-receipts", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const { data, error } = await supabase
        .from("goods_receipts")
        .select(`
          *,
          warehouse:warehouses(id, code, name),
          partner:partners(id, code, name)
        `)
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("receipt_number", { ascending: false });

      if (error) throw error;
      return data as GoodsReceipt[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const createReceipt = useMutation({
    mutationFn: async (formData: GoodsReceiptFormData) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Potrebno je izabrati firmu i godinu");
      }

      // Get next receipt number
      const { data: numberData, error: numberError } = await supabase.rpc(
        "get_next_goods_receipt_number",
        {
          _company_id: selectedCompany.id,
          _year_id: selectedYear.id,
        }
      );

      if (numberError) throw numberError;

      const { data, error } = await supabase
        .from("goods_receipts")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          receipt_number: numberData,
          ...formData,
          created_by: user.id,
        })
        .select(`
          *,
          warehouse:warehouses(id, code, name),
          partner:partners(id, code, name)
        `)
        .single();

      if (error) throw error;
      return data as GoodsReceipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      toast.success("Prijemnica uspešno kreirana");
    },
    onError: (error) => {
      toast.error(`Greška pri kreiranju: ${error.message}`);
    },
  });

  const updateReceipt = useMutation({
    mutationFn: async ({
      id,
      ...formData
    }: GoodsReceiptFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("goods_receipts")
        .update(formData)
        .eq("id", id)
        .select(`
          *,
          warehouse:warehouses(id, code, name),
          partner:partners(id, code, name)
        `)
        .single();

      if (error) throw error;
      return data as GoodsReceipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      toast.success("Prijemnica uspešno ažurirana");
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju: ${error.message}`);
    },
  });

  const deleteReceipt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("goods_receipts")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      toast.success("Prijemnica uspešno obrisana");
    },
    onError: (error) => {
      toast.error(`Greška pri brisanju: ${error.message}`);
    },
  });

  const postReceipt = useMutation({
    mutationFn: async (receiptId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");

      const { data, error } = await supabase.rpc("post_goods_receipt", {
        _receipt_id: receiptId,
        _user_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Prijemnica uspešno proknjižena - zalihe ažurirane");
    },
    onError: (error) => {
      toast.error(`Greška pri knjiženju: ${error.message}`);
    },
  });

  const unpostReceipt = useMutation({
    mutationFn: async (receiptId: string) => {
      if (!user?.id) throw new Error("Niste prijavljeni");

      const { data, error } = await supabase.rpc("unpost_goods_receipt", {
        _receipt_id: receiptId,
        _user_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Knjiženje poništeno - zalihe vraćene");
    },
    onError: (error) => {
      toast.error(`Greška pri poništavanju: ${error.message}`);
    },
  });

  return {
    receipts: receiptsQuery.data || [],
    isLoading: receiptsQuery.isLoading,
    error: receiptsQuery.error,
    createReceipt,
    updateReceipt,
    deleteReceipt,
    postReceipt,
    unpostReceipt,
  };
}

export function useGoodsReceiptItems(receiptId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({
    queryKey: ["goods-receipt-items", receiptId],
    queryFn: async () => {
      if (!receiptId) return [];

      const { data, error } = await supabase
        .from("goods_receipt_items")
        .select(`
          *,
          article:articles(id, code, name, unit)
        `)
        .eq("goods_receipt_id", receiptId)
        .order("item_order");

      if (error) throw error;
      return data as GoodsReceiptItem[];
    },
    enabled: !!receiptId,
  });

  const addItem = useMutation({
    mutationFn: async (
      item: GoodsReceiptItemFormData & { goods_receipt_id: string }
    ) => {
      if (!selectedCompany?.id) throw new Error("Potrebno je izabrati firmu");

      const { data: existingItems } = await supabase
        .from("goods_receipt_items")
        .select("item_order")
        .eq("goods_receipt_id", item.goods_receipt_id)
        .order("item_order", { ascending: false })
        .limit(1);

      const nextOrder = (existingItems?.[0]?.item_order || 0) + 1;

      const { data, error } = await supabase
        .from("goods_receipt_items")
        .insert({
          goods_receipt_id: item.goods_receipt_id,
          company_id: selectedCompany.id,
          item_order: nextOrder,
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })
        .select(`
          *,
          article:articles(id, code, name, unit)
        `)
        .single();

      if (error) throw error;
      return data as GoodsReceiptItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["goods-receipt-items", receiptId],
      });
    },
    onError: (error) => {
      toast.error(`Greška pri dodavanju stavke: ${error.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({
      id,
      ...item
    }: GoodsReceiptItemFormData & { id: string }) => {
      const { data, error } = await supabase
        .from("goods_receipt_items")
        .update({
          article_id: item.article_id,
          item_code: item.item_code,
          item_name: item.item_name,
          unit: item.unit,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })
        .eq("id", id)
        .select(`
          *,
          article:articles(id, code, name, unit)
        `)
        .single();

      if (error) throw error;
      return data as GoodsReceiptItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["goods-receipt-items", receiptId],
      });
      toast.success("Stavka uspešno ažurirana");
    },
    onError: (error) => {
      toast.error(`Greška pri ažuriranju stavke: ${error.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("goods_receipt_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["goods-receipt-items", receiptId],
      });
    },
    onError: (error) => {
      toast.error(`Greška pri brisanju stavke: ${error.message}`);
    },
  });

  return {
    items: itemsQuery.data || [],
    isLoading: itemsQuery.isLoading,
    addItem,
    updateItem,
    deleteItem,
  };
}
