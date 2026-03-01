import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getAllCellKeys } from "@/data/popdvFormStructure";

export interface PopdvReport {
  id: string;
  company_id: string;
  business_year_id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  period_label: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  finalized_by: string | null;
  note: string | null;
}

export interface PopdvReportCell {
  id: string;
  report_id: string;
  company_id: string;
  section: string;
  row_code: string;
  column_code: string;
  auto_value: number;
  manual_override: number | null;
  created_at: string;
  updated_at: string;
}

export function usePopdvReports() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;
  const yearId = selectedYear?.id;

  const reportsQuery = useQuery({
    queryKey: ["popdv_reports", companyId, yearId],
    queryFn: async () => {
      if (!companyId || !yearId) return [];
      const { data, error } = await supabase
        .from("popdv_reports")
        .select("*")
        .eq("company_id", companyId)
        .eq("business_year_id", yearId)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data as PopdvReport[];
    },
    enabled: !!companyId && !!yearId,
  });

  const createReport = useMutation({
    mutationFn: async (input: {
      period_type: string;
      period_start: string;
      period_end: string;
      period_label: string;
    }) => {
      if (!companyId || !yearId || !user) throw new Error("Missing context");

      // Create report
      const { data: report, error } = await supabase
        .from("popdv_reports")
        .insert({
          company_id: companyId,
          business_year_id: yearId,
          period_type: input.period_type,
          period_start: input.period_start,
          period_end: input.period_end,
          period_label: input.period_label,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Initialize all cells
      const cellKeys = getAllCellKeys();
      const cells = cellKeys.map((ck) => ({
        report_id: report.id,
        company_id: companyId,
        section: ck.section,
        row_code: ck.rowCode,
        column_code: ck.columnCode,
        auto_value: 0,
        manual_override: null,
      }));

      // Insert in batches
      for (let i = 0; i < cells.length; i += 100) {
        const batch = cells.slice(i, i + 100);
        const { error: cellError } = await supabase
          .from("popdv_report_cells")
          .insert(batch);
        if (cellError) throw cellError;
      }

      return report as PopdvReport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["popdv_reports", companyId, yearId] });
      toast.success("POPDV izveštaj kreiran");
    },
    onError: (err: any) => {
      toast.error(err.message || "Greška pri kreiranju izveštaja");
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("popdv_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["popdv_reports", companyId, yearId] });
      toast.success("Izveštaj obrisan");
    },
    onError: () => toast.error("Greška pri brisanju"),
  });

  return { reportsQuery, createReport, deleteReport };
}

export function usePopdvReportCells(reportId: string | undefined) {
  const queryClient = useQueryClient();

  const cellsQuery = useQuery({
    queryKey: ["popdv_report_cells", reportId],
    queryFn: async () => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from("popdv_report_cells")
        .select("*")
        .eq("report_id", reportId);
      if (error) throw error;
      return data as unknown as PopdvReportCell[];
    },
    enabled: !!reportId,
  });

  const updateCell = useMutation({
    mutationFn: async (input: { cellId: string; manual_override: number | null }) => {
      const { error } = await supabase
        .from("popdv_report_cells")
        .update({ manual_override: input.manual_override })
        .eq("id", input.cellId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["popdv_report_cells", reportId] });
    },
  });

  const updateAutoValues = useMutation({
    mutationFn: async (updates: { cellId: string; auto_value: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from("popdv_report_cells")
          .update({ auto_value: u.auto_value })
          .eq("id", u.cellId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["popdv_report_cells", reportId] });
    },
  });

  return { cellsQuery, updateCell, updateAutoValues };
}

export function usePopdvReportDetail(reportId: string | undefined) {
  return useQuery({
    queryKey: ["popdv_report_detail", reportId],
    queryFn: async () => {
      if (!reportId) return null;
      const { data, error } = await supabase
        .from("popdv_reports")
        .select("*")
        .eq("id", reportId)
        .single();
      if (error) throw error;
      return data as PopdvReport;
    },
    enabled: !!reportId,
  });
}

export function useFinalizePopdvReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (reportId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("popdv_reports")
        .update({ status: "finalized", finalized_at: new Date().toISOString(), finalized_by: user.id })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: (_, reportId) => {
      queryClient.invalidateQueries({ queryKey: ["popdv_report_detail", reportId] });
      queryClient.invalidateQueries({ queryKey: ["popdv_reports"] });
      toast.success("Izveštaj zaključen");
    },
    onError: () => toast.error("Greška pri zaključivanju"),
  });
}
