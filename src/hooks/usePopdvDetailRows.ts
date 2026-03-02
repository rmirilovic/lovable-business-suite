import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PopdvDetailRow {
  id: string;
  report_id: string;
  company_id: string;
  section: string;
  row_code: string;
  document_date: string | null;
  document_type_number: string | null;
  partner_info: string | null;
  values: Record<string, number>;
  item_order: number;
  created_at: string;
  updated_at: string;
}

export function usePopdvDetailRows(reportId: string | undefined) {
  const queryClient = useQueryClient();
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;

  const queryKey = ["popdv_detail_rows", reportId];

  const detailRowsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from("popdv_report_detail_rows")
        .select("*")
        .eq("report_id", reportId)
        .order("section")
        .order("row_code")
        .order("item_order");
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        values: r.values || {},
      })) as PopdvDetailRow[];
    },
    enabled: !!reportId,
  });

  const addRow = useMutation({
    mutationFn: async (input: {
      section: string;
      row_code: string;
      document_date?: string;
      document_type_number?: string;
      partner_info?: string;
      values?: Record<string, number>;
    }) => {
      if (!reportId || !companyId) throw new Error("Missing context");
      // Get max item_order for this row_code
      const existing = detailRowsQuery.data?.filter(
        (r) => r.row_code === input.row_code
      ) || [];
      const maxOrder = existing.reduce((max, r) => Math.max(max, r.item_order), -1);

      const { data, error } = await supabase
        .from("popdv_report_detail_rows")
        .insert({
          report_id: reportId,
          company_id: companyId,
          section: input.section,
          row_code: input.row_code,
          document_date: input.document_date || null,
          document_type_number: input.document_type_number || null,
          partner_info: input.partner_info || null,
          values: input.values || {},
          item_order: maxOrder + 1,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateRow = useMutation({
    mutationFn: async (input: {
      id: string;
      document_date?: string | null;
      document_type_number?: string | null;
      partner_info?: string | null;
      values?: Record<string, number>;
    }) => {
      const updateData: any = { updated_at: new Date().toISOString() };
      if (input.document_date !== undefined) updateData.document_date = input.document_date;
      if (input.document_type_number !== undefined) updateData.document_type_number = input.document_type_number;
      if (input.partner_info !== undefined) updateData.partner_info = input.partner_info;
      if (input.values !== undefined) updateData.values = input.values;

      const { error } = await supabase
        .from("popdv_report_detail_rows")
        .update(updateData)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("popdv_report_detail_rows")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Red obrisan");
    },
    onError: () => toast.error("Greška pri brisanju"),
  });

  return { detailRowsQuery, addRow, updateRow, deleteRow };
}
