import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MaterialRequisition {
  id: string;
  company_id: string;
  business_year_id: string;
  requisition_number: string;
  requisition_date: string;
  warehouse_id: string;
  work_order_id: string | null;
  note: string | null;
  issued_by: string;
  received_by: string;
  status: "draft" | "posted";
  posted_at: string | null;
  posted_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  warehouse?: { id: string; code: string; name: string };
  work_order?: { id: string; order_number: string } | null;
}

export interface MaterialRequisitionItem {
  id: string;
  requisition_id: string;
  company_id: string;
  article_id: string;
  article_code: string;
  article_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  item_value: number;
  item_order: number;
  created_at: string;
}

export const REQ_STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjižen",
};

export const REQ_STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  posted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const SELECT_QUERY = `*, warehouse:warehouses(id, code, name), work_order:work_orders(id, order_number)`;

export function useMaterialRequisitions() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;
  const yearId = selectedYear?.id;

  const query = useQuery({
    queryKey: ["material-requisitions", companyId, yearId],
    queryFn: async () => {
      if (!companyId || !yearId) return [];
      const { data, error } = await (supabase as any)
        .from("material_requisitions")
        .select(SELECT_QUERY)
        .eq("company_id", companyId)
        .eq("business_year_id", yearId)
        .order("requisition_number", { ascending: false });
      if (error) throw error;
      return data as MaterialRequisition[];
    },
    enabled: !!companyId && !!yearId,
  });

  const createRequisition = useMutation({
    mutationFn: async (formData: {
      requisition_date: string;
      warehouse_id: string;
      work_order_id?: string;
      note?: string;
      issued_by?: string;
      received_by?: string;
    }) => {
      if (!companyId || !yearId || !user?.id) throw new Error("Nedostaju podaci");

      const { data: reqNumber, error: numErr } = await supabase.rpc(
        "get_next_requisition_number" as any,
        { _company_id: companyId, _year_id: yearId }
      );
      if (numErr) throw numErr;

      const { data, error } = await (supabase as any)
        .from("material_requisitions")
        .insert({
          company_id: companyId,
          business_year_id: yearId,
          requisition_number: reqNumber,
          requisition_date: formData.requisition_date,
          warehouse_id: formData.warehouse_id,
          work_order_id: formData.work_order_id || null,
          note: formData.note || null,
          issued_by: formData.issued_by || "",
          received_by: formData.received_by || "",
          created_by: user.id,
        })
        .select(SELECT_QUERY)
        .single();
      if (error) throw error;
      return data as MaterialRequisition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-requisitions"] });
      toast.success("Trebovanje kreirano");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const updateRequisition = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MaterialRequisition> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("material_requisitions")
        .update(updates)
        .eq("id", id)
        .select(SELECT_QUERY)
        .single();
      if (error) throw error;
      return data as MaterialRequisition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["material-requisition"] });
      toast.success("Trebovanje ažurirano");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const deleteRequisition = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("material_requisitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-requisitions"] });
      toast.success("Trebovanje obrisano");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const postRequisition = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from("material_requisitions")
        .update({ status: "posted", posted_at: new Date().toISOString(), posted_by: user?.id })
        .eq("id", id)
        .select(SELECT_QUERY)
        .single();
      if (error) throw error;
      return data as MaterialRequisition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["material-requisition"] });
      toast.success("Trebovanje proknjiženo");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  const unpostRequisition = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from("material_requisitions")
        .update({ status: "draft", posted_at: null, posted_by: null })
        .eq("id", id)
        .select(SELECT_QUERY)
        .single();
      if (error) throw error;
      return data as MaterialRequisition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-requisitions"] });
      queryClient.invalidateQueries({ queryKey: ["material-requisition"] });
      toast.success("Knjiženje poništeno");
    },
    onError: (e) => toast.error(`Greška: ${e.message}`),
  });

  return {
    requisitions: query.data ?? [],
    isLoading: query.isLoading,
    createRequisition,
    updateRequisition,
    deleteRequisition,
    postRequisition,
    unpostRequisition,
  };
}

export function useMaterialRequisition(id: string | undefined) {
  return useQuery({
    queryKey: ["material-requisition", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_requisitions")
        .select(SELECT_QUERY)
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as MaterialRequisition;
    },
    enabled: !!id,
  });
}

export function useMaterialRequisitionItems(requisitionId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["material-requisition-items", requisitionId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("material_requisition_items")
        .select("*")
        .eq("requisition_id", requisitionId!)
        .order("item_order");
      if (error) throw error;
      return data as MaterialRequisitionItem[];
    },
    enabled: !!requisitionId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["material-requisition-items", requisitionId] });

  return { items: query.data ?? [], isLoading: query.isLoading, invalidate };
}
