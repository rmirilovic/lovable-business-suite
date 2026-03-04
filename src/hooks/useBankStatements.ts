import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BankStatement {
  id: string;
  company_id: string;
  business_year_id: string;
  statement_number: string;
  statement_date: string;
  bank_account_id: string;
  opening_balance: number;
  closing_balance: number;
  total_debit: number;
  total_credit: number;
  description: string | null;
  status: string;
  journal_entry_id: string | null;
  created_by: string;
  posted_at: string | null;
  posted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankStatementItem {
  id: string;
  bank_statement_id: string;
  company_id: string;
  item_order: number;
  payment_code_id: string | null;
  partner_id: string | null;
  reference_number: string | null;
  description: string | null;
  document_reference: string | null;
  debit_amount: number;
  credit_amount: number;
  created_at: string;
  // joined
  payment_code?: string | null;
  payment_name?: string | null;
  payment_account_code?: string | null;
  partner_name?: string | null;
  partner_code?: string | null;
}

export function useBankStatements() {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["bank_statements", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_statements")
        .select("*, bank_accounts(code, account_number, bank_name)")
        .eq("company_id", selectedCompany!.id)
        .eq("business_year_id", selectedYear!.id)
        .order("statement_number", { ascending: false });
      if (error) throw error;
      return data as (BankStatement & { bank_accounts: { code: string; account_number: string; bank_name: string } })[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });
}

export function useBankStatement(id: string | null) {
  return useQuery({
    queryKey: ["bank_statement", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_statements")
        .select("*, bank_accounts(code, account_number, bank_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as BankStatement & { bank_accounts: { code: string; account_number: string; bank_name: string } };
    },
    enabled: !!id,
  });
}

export function useBankStatementItems(statementId: string | null) {
  return useQuery({
    queryKey: ["bank_statement_items", statementId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_statement_items")
        .select("*, payment_codes(code, name, account_code), partners(code, name)")
        .eq("bank_statement_id", statementId!)
        .order("item_order");
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        payment_code: item.payment_codes?.code || null,
        payment_name: item.payment_codes?.name || null,
        payment_account_code: item.payment_codes?.account_code || null,
        partner_name: item.partners?.name || null,
        partner_code: item.partners?.code || null,
      })) as BankStatementItem[];
    },
    enabled: !!statementId,
  });
}

export function useBankStatementMutations() {
  const queryClient = useQueryClient();
  const { selectedCompany, selectedYear, user } = useAuth();

  const create = useMutation({
    mutationFn: async (data: { statement_date: string; bank_account_id: string; description?: string; opening_balance?: number }) => {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) throw new Error("Nedostaju podaci");

      // Fetch the bank account code for the number format
      const { data: ba, error: baErr } = await supabase
        .from("bank_accounts")
        .select("code")
        .eq("id", data.bank_account_id)
        .single();
      if (baErr) throw baErr;

      // Build statement number as YYMMDD.BankCode
      const d = new Date(data.statement_date);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const statementNumber = `${yy}${mm}${dd}.${ba.code}`;

      const { data: result, error } = await supabase
        .from("bank_statements")
        .insert({
          company_id: selectedCompany.id,
          business_year_id: selectedYear.id,
          statement_number: statementNumber,
          created_by: user.id,
          ...data,
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_statements"] });
      toast.success("Izvod je kreiran");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BankStatement> & { id: string }) => {
      const { data, error } = await supabase
        .from("bank_statements")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_statements"] });
      queryClient.invalidateQueries({ queryKey: ["bank_statement"] });
      toast.success("Izvod je ažuriran");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_statements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_statements"] });
      toast.success("Izvod je obrisan");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  const post = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Korisnik nije prijavljen");
      const { data, error } = await supabase.rpc("post_bank_statement", {
        _statement_id: id,
        _user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_statements"] });
      queryClient.invalidateQueries({ queryKey: ["bank_statement"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Izvod je proknjižen");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  const unpost = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Korisnik nije prijavljen");
      const { data, error } = await supabase.rpc("unpost_bank_statement", {
        _statement_id: id,
        _user_id: user.id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank_statements"] });
      queryClient.invalidateQueries({ queryKey: ["bank_statement"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Izvod je vraćen u nacrt");
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  return { create, update, remove, post, unpost };
}

export function useBankStatementItemMutations() {
  const queryClient = useQueryClient();
  const { selectedCompany } = useAuth();

  const addItem = useMutation({
    mutationFn: async (item: Omit<BankStatementItem, "id" | "created_at" | "company_id" | "payment_code" | "payment_name" | "payment_account_code" | "partner_name" | "partner_code">) => {
      if (!selectedCompany?.id) throw new Error("Nije izabrana firma");
      const { data, error } = await supabase
        .from("bank_statement_items")
        .insert({ ...item, company_id: selectedCompany.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["bank_statement_items", vars.bank_statement_id] });
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BankStatementItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("bank_statement_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["bank_statement_items", data.bank_statement_id] });
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  const deleteItem = useMutation({
    mutationFn: async ({ id, statementId }: { id: string; statementId: string }) => {
      const { error } = await supabase.from("bank_statement_items").delete().eq("id", id);
      if (error) throw error;
      return statementId;
    },
    onSuccess: (statementId) => {
      queryClient.invalidateQueries({ queryKey: ["bank_statement_items", statementId] });
    },
    onError: (e: Error) => toast.error(`Greška: ${e.message}`),
  });

  return { addItem, updateItem, deleteItem };
}
