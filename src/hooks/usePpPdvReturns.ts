import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface PpPdvReturn {
  id: string;
  company_id: string;
  business_year_id: string;
  popdv_report_id: string | null;
  period_type: string;
  period_start: string;
  period_end: string;
  period_label: string;
  status: string;
  pib: string | null;
  company_name: string | null;
  municipality_code: string | null;
  activity_code: string | null;
  responsible_person_name: string | null;
  responsible_person_jmbg: string | null;
  email: string | null;
  field_001: number;
  field_002: number;
  field_003: number;
  field_004: number;
  field_005: number;
  field_006: number;
  field_007: number;
  field_008: number;
  field_009: number;
  field_010: number;
  field_011: number;
  field_101: number;
  field_102: number;
  field_103: number;
  field_104: number;
  field_105: number;
  field_106: number;
  field_107: number;
  field_108: number;
  field_201: number;
  field_202: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  finalized_by: string | null;
  note: string | null;
}

export function usePpPdvReturns() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;
  const yearId = selectedYear?.id;

  const returnsQuery = useQuery({
    queryKey: ["pp_pdv_returns", companyId, yearId],
    queryFn: async () => {
      if (!companyId || !yearId) return [];
      const { data, error } = await supabase
        .from("pp_pdv_returns")
        .select("*")
        .eq("company_id", companyId)
        .eq("business_year_id", yearId)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data as PpPdvReturn[];
    },
    enabled: !!companyId && !!yearId,
  });

  const createReturn = useMutation({
    mutationFn: async (input: {
      period_type: string;
      period_start: string;
      period_end: string;
      period_label: string;
      popdv_report_id?: string;
    }) => {
      if (!companyId || !yearId || !user) throw new Error("Missing context");

      // Fetch full company details for snapshot
      const { data: companyData } = await supabase
        .from("companies")
        .select("pib, name, municipality_code, activity_code, responsible_person_name, responsible_person_jmbg, email")
        .eq("id", companyId)
        .single();

      const { data, error } = await supabase
        .from("pp_pdv_returns")
        .insert({
          company_id: companyId,
          business_year_id: yearId,
          period_type: input.period_type,
          period_start: input.period_start,
          period_end: input.period_end,
          period_label: input.period_label,
          popdv_report_id: input.popdv_report_id || null,
          pib: companyData?.pib || null,
          company_name: companyData?.name || null,
          municipality_code: companyData?.municipality_code || null,
          activity_code: companyData?.activity_code || null,
          responsible_person_name: companyData?.responsible_person_name || null,
          responsible_person_jmbg: companyData?.responsible_person_jmbg || null,
          email: companyData?.email || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as PpPdvReturn;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pp_pdv_returns", companyId, yearId] });
      toast.success("PP-PDV prijava kreirana");
    },
    onError: (err: any) => {
      toast.error(err.message || "Greška pri kreiranju prijave");
    },
  });

  const deleteReturn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pp_pdv_returns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pp_pdv_returns", companyId, yearId] });
      toast.success("Prijava obrisana");
    },
    onError: () => toast.error("Greška pri brisanju"),
  });

  return { returnsQuery, createReturn, deleteReturn };
}

export function usePpPdvReturnDetail(returnId: string | undefined) {
  return useQuery({
    queryKey: ["pp_pdv_return_detail", returnId],
    queryFn: async () => {
      if (!returnId) return null;
      const { data, error } = await supabase
        .from("pp_pdv_returns")
        .select("*")
        .eq("id", returnId)
        .single();
      if (error) throw error;
      return data as PpPdvReturn;
    },
    enabled: !!returnId,
  });
}

export function usePpPdvReturnMutations(returnId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const updateFields = useMutation({
    mutationFn: async (fields: Partial<PpPdvReturn>) => {
      if (!returnId) throw new Error("No return ID");
      const { error } = await supabase
        .from("pp_pdv_returns")
        .update(fields)
        .eq("id", returnId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pp_pdv_return_detail", returnId] });
    },
  });

  const finalizeReturn = useMutation({
    mutationFn: async () => {
      if (!returnId || !user) throw new Error("Missing context");
      const { error } = await supabase
        .from("pp_pdv_returns")
        .update({
          status: "finalized",
          finalized_at: new Date().toISOString(),
          finalized_by: user.id,
        })
        .eq("id", returnId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pp_pdv_return_detail", returnId] });
      queryClient.invalidateQueries({ queryKey: ["pp_pdv_returns"] });
      toast.success("PP-PDV prijava zaključena");
    },
    onError: () => toast.error("Greška pri zaključivanju"),
  });

  return { updateFields, finalizeReturn };
}
