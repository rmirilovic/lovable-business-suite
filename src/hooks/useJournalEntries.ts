import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type DocumentStatus = "draft" | "posted" | "cancelled";

export interface JournalEntry {
  id: string;
  company_id: string;
  business_year_id: string;
  org_unit_id: string | null;
  entry_number: string;
  entry_date: string;
  document_date: string | null;
  document_number: string | null;
  description: string;
  status: DocumentStatus;
  total_debit: number;
  total_credit: number;
  posted_at: string | null;
  posted_by: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryItem {
  id: string;
  journal_entry_id: string;
  company_id: string;
  account_code: string;
  item_order: number;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
  partner_id: string | null;
  partner_code?: string | null;
  account_name?: string | null;
  cost_center_code: string | null;
  created_at: string;
  document_date: string | null;
}

export function useJournalEntries() {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["journal-entries", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("entry_number", { ascending: false });

      if (error) throw error;
      return data as JournalEntry[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });
}

export function useJournalEntryItems(entryId: string | null) {
  return useQuery({
    queryKey: ["journal-entry-items", entryId],
    queryFn: async () => {
      if (!entryId) return [];

      const { data, error } = await supabase
        .from("journal_entry_items")
        .select("*, partners(code)")
        .eq("journal_entry_id", entryId)
        .order("item_order");

      if (error) throw error;

      // Fetch account names for all unique account codes
      const accountCodes = [...new Set((data || []).map((item: any) => item.account_code))];
      let accountMap: Record<string, string> = {};
      if (accountCodes.length > 0) {
        const { data: accounts } = await supabase
          .from("chart_of_accounts")
          .select("code, name")
          .in("code", accountCodes);
        if (accounts) {
          accountMap = Object.fromEntries(accounts.map(a => [a.code, a.name]));
        }
      }

      return (data || []).map((item: any) => ({
        ...item,
        partner_code: item.partners?.code || null,
        account_name: accountMap[item.account_code] || null,
      })) as JournalEntryItem[];
    },
    enabled: !!entryId,
  });
}

export function useJournalEntryMutations() {
  const queryClient = useQueryClient();
  const { selectedCompany, selectedYear, user } = useAuth();

  const createEntry = useMutation({
    mutationFn: async (entry: { description: string; entry_date: string; document_date?: string; document_number?: string }) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) {
        throw new Error("Nedostaju podaci");
      }

      // Get next entry number (returns "R-YYNNNN" text)
      const { data: nextNum } = await supabase.rpc("get_next_journal_entry_number", {
        _company_id: selectedCompany.id,
        _year_id: selectedYear.id,
      });

      const { data, error } = await supabase
        .from("journal_entries")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          entry_number: nextNum || 'R-000001',
          created_by: user.id,
          ...entry,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Nalog za knjiženje je kreiran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<JournalEntry, 'entry_number'>> & { id: string }) => {
      const { data, error } = await supabase
        .from("journal_entries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Nalog je ažuriran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Nalog je obrisan");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const postEntry = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Korisnik nije prijavljen");

      const { data, error } = await supabase.rpc("post_journal_entry", {
        _entry_id: id,
        _user_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Nalog je uspešno proknjižen");
    },
    onError: (error: Error) => {
      toast.error(`Greška pri knjiženju: ${error.message}`);
    },
  });

  const unpostEntry = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Korisnik nije prijavljen");

      const { data, error } = await supabase.rpc("unpost_journal_entry", {
        _entry_id: id,
        _user_id: user.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Nalog je vraćen u status Nacrt");
    },
    onError: (error: Error) => {
      toast.error(`Greška pri poništavanju: ${error.message}`);
    },
  });

  return { createEntry, updateEntry, deleteEntry, postEntry, unpostEntry };
}

export function useJournalEntryItemMutations() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useAuth();

  const addItem = useMutation({
    mutationFn: async (item: Omit<JournalEntryItem, "id" | "created_at" | "company_id">) => {
      if (!selectedCompany?.id) throw new Error("Nije izabrana firma");

      const { data, error } = await supabase
        .from("journal_entry_items")
        .insert({ ...item, company_id: selectedCompany.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["journal-entry-items", variables.journal_entry_id] });
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<JournalEntryItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("journal_entry_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["journal-entry-items", data.journal_entry_id] });
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const deleteItem = useMutation({
    mutationFn: async ({ id, entryId }: { id: string; entryId: string }) => {
      const { error } = await supabase
        .from("journal_entry_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return entryId;
    },
    onSuccess: (entryId) => {
      queryClient.invalidateQueries({ queryKey: ["journal-entry-items", entryId] });
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  return { addItem, updateItem, deleteItem };
}

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  draft: "Nacrt",
  posted: "Proknjižen",
  cancelled: "Storniran",
};

export const STATUS_COLORS: Record<DocumentStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
