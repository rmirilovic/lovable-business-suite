import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type WacReconStatus = "draft" | "previewed" | "applied" | "reverted" | "failed";
export type WacReconTrigger = "manual" | "auto" | "nightly_cron";

export interface WacReconRun {
  id: string;
  company_id: string;
  business_year_id: string | null;
  warehouse_id: string | null;
  article_id: string | null;
  reconcile_from_date: string;
  reconcile_to_date: string | null;
  trigger_type: WacReconTrigger;
  trigger_source_type: string | null;
  trigger_source_id: string | null;
  status: WacReconStatus;
  affected_documents_count: number;
  affected_articles_count: number;
  total_value_difference: number;
  correction_journal_entry_id: string | null;
  created_by: string;
  created_at: string;
  previewed_at: string | null;
  applied_at: string | null;
  reverted_at: string | null;
  override_pdv_period: boolean;
  override_reason: string | null;
  notes: string | null;
  error_message: string | null;
}

export interface WacReconChange {
  id: string;
  run_id: string;
  document_type: string;
  document_id: string;
  document_item_id: string;
  document_number: string | null;
  document_date: string;
  warehouse_id: string;
  article_id: string;
  variant_id: string | null;
  quantity: number;
  old_unit_cost: number;
  new_unit_cost: number;
  old_total_cost: number;
  new_total_cost: number;
  cost_difference: number;
  account_code: string | null;
  cost_center_code: string | null;
  processing_order: number;
  applied: boolean;
}

export function useWacReconciliationRuns() {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["wac-recon-runs", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from("wac_reconciliation_runs")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as WacReconRun[];
    },
    enabled: !!selectedCompany?.id,
  });
}

/**
 * Vraća broj otvorenih nacrta usklađivanja PNC za badge u sidebar-u.
 * Osvežava se na svakih 60s ili pri fokusiranju prozora.
 */
export function useWacReconciliationPendingCount() {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["wac-recon-pending-count", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return 0;
      const { count, error } = await supabase
        .from("wac_reconciliation_runs")
        .select("id", { count: "exact", head: true })
        .eq("company_id", selectedCompany.id)
        .in("status", ["draft", "previewed"]);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!selectedCompany?.id,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useWacReconciliationChanges(runId: string | null) {
  return useQuery({
    queryKey: ["wac-recon-changes", runId],
    queryFn: async () => {
      if (!runId) return [];
      const { data, error } = await supabase
        .from("wac_reconciliation_changes")
        .select("*")
        .eq("run_id", runId)
        .order("processing_order");
      if (error) throw error;
      return (data || []) as WacReconChange[];
    },
    enabled: !!runId,
  });
}

export function useWacReconciliationMutations() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useAuth();

  const detect = useMutation({
    mutationFn: async (params: {
      warehouse_id: string;
      article_id?: string | null;
      from_date?: string | null;
      notes?: string | null;
    }) => {
      if (!selectedCompany?.id) throw new Error("Firma nije izabrana");
      const { data, error } = await supabase.rpc("wac_recon_detect", {
        _company_id: selectedCompany.id,
        _warehouse_id: params.warehouse_id,
        _article_id: params.article_id ?? null,
        _from_date: params.from_date ?? null,
        _trigger_type: "manual",
        _trigger_source_type: null,
        _trigger_source_id: null,
        _notes: params.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wac-recon-runs"] });
      toast.success("Rekonsilijacija je inicijalizovana");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  const preview = useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.rpc("wac_recon_preview", { _run_id: runId });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, runId) => {
      queryClient.invalidateQueries({ queryKey: ["wac-recon-runs"] });
      queryClient.invalidateQueries({ queryKey: ["wac-recon-changes", runId] });
      toast.success("Pregled izmena je generisan");
    },
    onError: (e: Error) => toast.error(`Greška u pregledu: ${e.message}`),
  });

  const apply = useMutation({
    mutationFn: async (params: { runId: string; overridePdv?: boolean; overrideReason?: string | null }) => {
      const { data, error } = await supabase.rpc("wac_recon_apply", {
        _run_id: params.runId,
        _override_pdv: params.overridePdv ?? false,
        _override_reason: params.overrideReason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, params) => {
      queryClient.invalidateQueries({ queryKey: ["wac-recon-runs"] });
      queryClient.invalidateQueries({ queryKey: ["wac-recon-changes", params.runId] });
      toast.success("Rekonsilijacija je primenjena i nalog za ispravku je proknjižen");
    },
    onError: (e: Error) => toast.error(`Greška pri primeni: ${e.message}`),
  });

  const revert = useMutation({
    mutationFn: async (params: { runId: string; reason?: string | null }) => {
      const { data, error } = await supabase.rpc("wac_recon_revert", {
        _run_id: params.runId,
        _reason: params.reason ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, params) => {
      queryClient.invalidateQueries({ queryKey: ["wac-recon-runs"] });
      queryClient.invalidateQueries({ queryKey: ["wac-recon-changes", params.runId] });
      toast.success("Rekonsilijacija je poništena");
    },
    onError: (e: Error) => toast.error(`Greška pri poništavanju: ${e.message}`),
  });

  return { detect, preview, apply, revert };
}

export const WAC_STATUS_LABELS: Record<WacReconStatus, string> = {
  draft: "Nacrt",
  previewed: "Pregledan",
  applied: "Primenjen",
  reverted: "Poništen",
  failed: "Greška",
};

export const WAC_STATUS_COLORS: Record<WacReconStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  previewed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  applied: "bg-primary text-primary-foreground",
  reverted: "bg-muted text-muted-foreground",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const WAC_TRIGGER_LABELS: Record<WacReconTrigger, string> = {
  manual: "Ručno",
  auto: "Automatski",
  nightly_cron: "Noćni cron",
};
