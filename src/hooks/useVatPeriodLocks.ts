import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface VatPeriodLock {
  id: string;
  company_id: string;
  business_year_id: string;
  period_start: string;
  period_end: string;
  period_label: string;
  pp_pdv_return_id: string | null;
  locked_at: string;
  locked_by: string;
  unlocked_at: string | null;
  unlocked_by: string | null;
  unlock_reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VatPeriodLockAudit {
  id: string;
  company_id: string;
  vat_period_lock_id: string;
  action: "lock" | "unlock";
  performed_by: string;
  performed_at: string;
  reason: string | null;
  details: any;
}

/** Lista svih lockova (aktivnih + istorijskih) za izabranu firmu/godinu. */
export function useVatPeriodLocks() {
  const { selectedCompany, selectedYear } = useAuth();
  const companyId = selectedCompany?.id;
  const yearId = selectedYear?.id;

  return useQuery({
    queryKey: ["vat_period_locks", companyId, yearId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("vat_period_locks")
        .select("*")
        .eq("company_id", companyId)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return (data || []) as VatPeriodLock[];
    },
    enabled: !!companyId,
  });
}

/** Audit istorija akcija (lock/unlock). */
export function useVatPeriodLockAudit() {
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: ["vat_period_lock_audit", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("vat_period_lock_audit")
        .select("*")
        .eq("company_id", companyId)
        .order("performed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as VatPeriodLockAudit[];
    },
    enabled: !!companyId,
  });
}

/** Da li je dati datum (yyyy-mm-dd) u zaključanom PDV periodu? */
export function useIsDateLocked(date: string | undefined) {
  const { selectedCompany } = useAuth();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: ["is_vat_period_locked", companyId, date],
    queryFn: async () => {
      if (!companyId || !date) return false;
      const { data, error } = await supabase.rpc("is_vat_period_locked", {
        _company_id: companyId,
        _check_date: date,
      });
      if (error) throw error;
      return Boolean(data);
    },
    enabled: !!companyId && !!date,
  });
}

/** Mutacije za zaključavanje / otključavanje. */
export function useVatPeriodLockMutations() {
  const queryClient = useQueryClient();

  const lockPeriod = useMutation({
    mutationFn: async (ppPdvReturnId: string) => {
      const { data, error } = await supabase.rpc("lock_vat_period", {
        _pp_pdv_return_id: ppPdvReturnId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat_period_locks"] });
      queryClient.invalidateQueries({ queryKey: ["vat_period_lock_audit"] });
      queryClient.invalidateQueries({ queryKey: ["is_vat_period_locked"] });
      toast.success("PDV period je zaključan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlockPeriod = useMutation({
    mutationFn: async ({ lockId, reason }: { lockId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("unlock_vat_period", {
        _lock_id: lockId,
        _reason: reason,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vat_period_locks"] });
      queryClient.invalidateQueries({ queryKey: ["vat_period_lock_audit"] });
      queryClient.invalidateQueries({ queryKey: ["is_vat_period_locked"] });
      toast.success("PDV period je otključan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { lockPeriod, unlockPeriod };
}
