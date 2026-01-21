import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Partner {
  id: string;
  company_id: string;
  code: string;
  name: string;
  legal_status: number;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  email: string | null;
  group_id: string | null;
  pib: string | null;
  mb: string | null;
  activity_code: string | null;
  jbkjs: string | null;
  website: string | null;
  responsible_person: string | null;
  phone: string | null;
  is_customer: boolean;
  is_supplier: boolean;
  is_in_pdv: boolean;
  assigned_to: string | null;
  note: string | null;
  other_data: string | null;
  is_active: boolean;
  payment_priority: number | null;
  created_at: string;
  updated_at: string;
  partner_groups?: PartnerGroup | null;
}

export interface PartnerGroup {
  id: string;
  company_id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerBankAccount {
  id: string;
  partner_id: string;
  company_id: string;
  account_number: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerContact {
  id: string;
  partner_id: string;
  company_id: string;
  contact_name: string;
  position: string | null;
  phone1: string | null;
  phone2: string | null;
  email: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type PartnerInsert = Omit<Partner, "id" | "created_at" | "updated_at" | "partner_groups">;
export type PartnerUpdate = Partial<Omit<Partner, "id" | "company_id" | "created_at" | "updated_at" | "partner_groups">>;

export type PartnerGroupInsert = Omit<PartnerGroup, "id" | "created_at" | "updated_at">;
export type PartnerGroupUpdate = Partial<Omit<PartnerGroup, "id" | "company_id" | "created_at" | "updated_at">>;

export type PartnerBankAccountInsert = Omit<PartnerBankAccount, "id" | "created_at" | "updated_at">;
export type PartnerBankAccountUpdate = Partial<Omit<PartnerBankAccount, "id" | "partner_id" | "company_id" | "created_at" | "updated_at">>;

export type PartnerContactInsert = Omit<PartnerContact, "id" | "created_at" | "updated_at">;
export type PartnerContactUpdate = Partial<Omit<PartnerContact, "id" | "partner_id" | "company_id" | "created_at" | "updated_at">>;

export const LEGAL_STATUS_LABELS: Record<number, string> = {
  1: "Pravno lice",
  2: "Fizičko lice",
  3: "Javno preduzeće",
  4: "Ino partner",
};

export const PAYMENT_PRIORITY_LABELS: Record<number, string> = {
  1: "I prioritet",
  2: "II prioritet",
  3: "III prioritet",
};

async function fetchPartners(companyId: string): Promise<Partner[]> {
  const allPartners: Partner[] = [];
  const batchSize = 1000;
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from("partners")
      .select("*, partner_groups(*)")
      .eq("company_id", companyId)
      .order("code")
      .range(from, from + batchSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allPartners.push(...(data as Partner[]));
    
    if (data.length < batchSize) break;
    from += batchSize;
  }
  
  return allPartners;
}

async function fetchPartnerGroups(companyId: string): Promise<PartnerGroup[]> {
  const { data, error } = await supabase
    .from("partner_groups")
    .select("*")
    .eq("company_id", companyId)
    .order("code");
  if (error) throw error;
  return data as PartnerGroup[];
}

async function fetchPartnerBankAccounts(partnerId: string): Promise<PartnerBankAccount[]> {
  const { data, error } = await supabase
    .from("partner_bank_accounts")
    .select("*")
    .eq("partner_id", partnerId)
    .order("sort_order");
  if (error) throw error;
  return data as PartnerBankAccount[];
}

async function fetchPartnerContacts(partnerId: string): Promise<PartnerContact[]> {
  const { data, error } = await supabase
    .from("partner_contacts")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at");
  if (error) throw error;
  return data as PartnerContact[];
}

export function usePartners() {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;

  const { data: partners = [], isLoading, error } = useQuery({
    queryKey: ["partners", companyId],
    queryFn: () => fetchPartners(companyId!),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (partner: PartnerInsert) => {
      const { data, error } = await supabase
        .from("partners")
        .insert(partner)
        .select("*, partner_groups(*)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners", companyId] });
      toast.success("Partner uspešno kreiran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PartnerUpdate }) => {
      const { data, error } = await supabase
        .from("partners")
        .update(updates)
        .eq("id", id)
        .eq("company_id", companyId!)
        .select("*, partner_groups(*)")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Partner nije pronađen ili nemate pristup za izmenu");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners", companyId] });
      toast.success("Partner uspešno ažuriran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners", companyId] });
      toast.success("Partner uspešno obrisan");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  return {
    partners,
    isLoading,
    error,
    createPartner: createMutation.mutateAsync,
    updatePartner: updateMutation.mutateAsync,
    deletePartner: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function usePartnerGroups() {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;

  const { data: groups = [], isLoading, error } = useQuery({
    queryKey: ["partner_groups", companyId],
    queryFn: () => fetchPartnerGroups(companyId!),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async (group: PartnerGroupInsert) => {
      const { data, error } = await supabase
        .from("partner_groups")
        .insert(group)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_groups", companyId] });
      toast.success("Grupa uspešno kreirana");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PartnerGroupUpdate }) => {
      const { data, error } = await supabase
        .from("partner_groups")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_groups", companyId] });
      toast.success("Grupa uspešno ažurirana");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_groups", companyId] });
      toast.success("Grupa uspešno obrisana");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  return {
    groups,
    isLoading,
    error,
    createGroup: createMutation.mutateAsync,
    updateGroup: updateMutation.mutateAsync,
    deleteGroup: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function usePartnerBankAccounts(partnerId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;

  const { data: bankAccounts = [], isLoading, error } = useQuery({
    queryKey: ["partner_bank_accounts", partnerId],
    queryFn: () => fetchPartnerBankAccounts(partnerId!),
    enabled: !!partnerId,
  });

  const createMutation = useMutation({
    mutationFn: async (account: PartnerBankAccountInsert) => {
      const { data, error } = await supabase
        .from("partner_bank_accounts")
        .insert(account)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_bank_accounts", partnerId] });
      toast.success("Račun uspešno dodat");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PartnerBankAccountUpdate }) => {
      const { data, error } = await supabase
        .from("partner_bank_accounts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_bank_accounts", partnerId] });
      toast.success("Račun uspešno ažuriran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_bank_accounts", partnerId] });
      toast.success("Račun uspešno obrisan");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (accounts: { id: string; sort_order: number }[]) => {
      const promises = accounts.map(({ id, sort_order }) =>
        supabase.from("partner_bank_accounts").update({ sort_order }).eq("id", id)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_bank_accounts", partnerId] });
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  return {
    bankAccounts,
    isLoading,
    error,
    createBankAccount: createMutation.mutateAsync,
    updateBankAccount: updateMutation.mutateAsync,
    deleteBankAccount: deleteMutation.mutateAsync,
    reorderBankAccounts: reorderMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function usePartnerContacts(partnerId: string | null) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;

  const { data: contacts = [], isLoading, error } = useQuery({
    queryKey: ["partner_contacts", partnerId],
    queryFn: () => fetchPartnerContacts(partnerId!),
    enabled: !!partnerId,
  });

  const createMutation = useMutation({
    mutationFn: async (contact: PartnerContactInsert) => {
      const { data, error } = await supabase
        .from("partner_contacts")
        .insert(contact)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_contacts", partnerId] });
      toast.success("Kontakt uspešno dodat");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PartnerContactUpdate }) => {
      const { data, error } = await supabase
        .from("partner_contacts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_contacts", partnerId] });
      toast.success("Kontakt uspešno ažuriran");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("partner_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner_contacts", partnerId] });
      toast.success("Kontakt uspešno obrisan");
    },
    onError: (error: Error) => {
      toast.error(`Greška: ${error.message}`);
    },
  });

  return {
    contacts,
    isLoading,
    error,
    createContact: createMutation.mutateAsync,
    updateContact: updateMutation.mutateAsync,
    deleteContact: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
