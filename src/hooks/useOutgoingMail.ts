import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_MAP, STATUS_LABELS, STATUS_VARIANTS } from "@/hooks/useIncomingMail";

export { DOCUMENT_TYPES, DOCUMENT_TYPE_MAP, STATUS_LABELS, STATUS_VARIANTS };

export interface OutgoingMail {
  id: string;
  company_id: string;
  business_year_id: string;
  created_by: string;
  mail_number: string;
  document_type: string;
  document_number: string;
  document_date: string;
  registration_date: string | null;
  recipient_partner_id: string | null;
  recipient_name: string;
  recipient_address: string | null;
  amount: number | null;
  note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useOutgoingMail(statusFilter?: string) {
  const { selectedCompany, selectedYear } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["outgoing-mail", selectedCompany?.id, selectedYear?.id, statusFilter],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      let q = supabase
        .from("outgoing_mail")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("mail_number", { ascending: false });

      if (statusFilter) {
        q = q.eq("status", statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as OutgoingMail[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const generateMailNumber = async () => {
    if (!selectedCompany?.id || !selectedYear?.id) return "";
    const yearSuffix = String(selectedYear.year).slice(-2);

    const { data } = await supabase
      .from("outgoing_mail")
      .select("mail_number")
      .eq("company_id", selectedCompany.id)
      .eq("business_year_id", selectedYear.id)
      .order("mail_number", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].mail_number.slice(2), 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    return `${yearSuffix}${String(nextNum).padStart(4, "0")}`;
  };

  const createMail = useMutation({
    mutationFn: async (formData: Partial<OutgoingMail>) => {
      const { data, error } = await supabase
        .from("outgoing_mail")
        .insert(formData as any)
        .select()
        .single();
      if (error) throw error;
      return data as OutgoingMail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoing-mail"] });
      toast.success("Dokument kreiran");
    },
    onError: (error: any) => {
      toast.error("Greška: " + error.message);
    },
  });

  const updateMail = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<OutgoingMail>) => {
      const { data, error } = await supabase
        .from("outgoing_mail")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as OutgoingMail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoing-mail"] });
      toast.success("Dokument ažuriran");
    },
    onError: (error: any) => {
      toast.error("Greška: " + error.message);
    },
  });

  const deleteMail = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("outgoing_mail")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoing-mail"] });
      toast.success("Dokument obrisan");
    },
    onError: (error: any) => {
      toast.error("Greška: " + error.message);
    },
  });

  return {
    mails: query.data || [],
    isLoading: query.isLoading,
    createMail,
    updateMail,
    deleteMail,
    generateMailNumber,
  };
}
