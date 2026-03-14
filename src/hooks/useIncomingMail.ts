import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface IncomingMail {
  id: string;
  company_id: string;
  business_year_id: string;
  created_by: string;
  mail_number: string;
  registration_date: string | null;
  document_type: string;
  document_number: string;
  document_date: string;
  partner_id: string | null;
  sender_name: string;
  sender_pib: string | null;
  sender_mb: string | null;
  amount: number | null;
  note: string | null;
  is_correct: boolean;
  incorrect_reason: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  liquidator_user_id: string | null;
  liquidator_name: string | null;
  archive_label: string | null;
  cost_center_distribution: string | null;
  liquidation_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// Hardcoded document types
export const DOCUMENT_TYPES = [
  { value: "faktura", label: "Faktura", isFinancial: true, requiresAmount: true },
  { value: "faktura_avans", label: "Faktura za avans", isFinancial: true, requiresAmount: true },
  { value: "knjizno_odobrenje", label: "Knjižno odobrenje", isFinancial: true, requiresAmount: true },
  { value: "knjizno_zaduzenje", label: "Knjižno zaduženje", isFinancial: true, requiresAmount: true },
  { value: "predracun", label: "Predračun", isFinancial: true, requiresAmount: false },
  { value: "obracun_kamate", label: "Obračun kamate", isFinancial: true, requiresAmount: false },
  { value: "ios", label: "IOS", isFinancial: true, requiresAmount: false },
  { value: "ugovor", label: "Ugovor", isFinancial: false, requiresAmount: false },
  { value: "dopis", label: "Dopis", isFinancial: false, requiresAmount: false },
  { value: "resenje", label: "Rešenje", isFinancial: false, requiresAmount: false },
  { value: "obavestenje", label: "Obaveštenje", isFinancial: false, requiresAmount: false },
  { value: "potvrda", label: "Potvrda", isFinancial: false, requiresAmount: false },
  { value: "ostalo", label: "Ostalo", isFinancial: false, requiresAmount: false },
] as const;

export const DOCUMENT_TYPE_MAP = Object.fromEntries(
  DOCUMENT_TYPES.map((dt) => [dt.value, dt])
);

export const STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  registered: "Zaveden",
  liquidated: "Likvidiran",
  cancelled: "Storniran",
};

export const STATUS_VARIANTS: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  draft: "secondary",
  registered: "outline",
  liquidated: "default",
  cancelled: "destructive",
};

export function useIncomingMail(statusFilter?: string) {
  const { selectedCompany, selectedYear } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["incoming-mail", selectedCompany?.id, selectedYear?.id, statusFilter],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];
      let q = supabase
        .from("incoming_mail")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("mail_number", { ascending: false });
      
      if (statusFilter) {
        q = q.eq("status", statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as IncomingMail[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });

  const generateMailNumber = async () => {
    if (!selectedCompany?.id || !selectedYear?.id) return "";
    const yearSuffix = String(selectedYear.year).slice(-2);
    
    const { data } = await supabase
      .from("incoming_mail")
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
    mutationFn: async (formData: Partial<IncomingMail>) => {
      const { data, error } = await supabase
        .from("incoming_mail")
        .insert(formData as any)
        .select()
        .single();
      if (error) throw error;
      return data as IncomingMail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incoming-mail"] });
      toast.success("Dokument kreiran");
    },
    onError: (error: any) => {
      toast.error("Greška: " + error.message);
    },
  });

  const updateMail = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<IncomingMail>) => {
      const { data, error } = await supabase
        .from("incoming_mail")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as IncomingMail;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incoming-mail"] });
      toast.success("Dokument ažuriran");
    },
    onError: (error: any) => {
      toast.error("Greška: " + error.message);
    },
  });

  const deleteMail = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("incoming_mail")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incoming-mail"] });
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

export function useCompanyUsers() {
  const { selectedCompany } = useAuth();

  return useQuery({
    queryKey: ["company-users", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const [roleAssignmentsRes, userCompaniesRes, superAdminsRes] = await Promise.all([
        supabase
          .from("user_role_assignments")
          .select("user_id")
          .eq("company_id", selectedCompany.id)
          .eq("is_active", true),
        supabase
          .from("user_companies")
          .select("user_id")
          .eq("company_id", selectedCompany.id),
        supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "super_admin"),
      ]);

      if (roleAssignmentsRes.error) throw roleAssignmentsRes.error;
      if (userCompaniesRes.error) throw userCompaniesRes.error;
      if (superAdminsRes.error) throw superAdminsRes.error;

      const userIds = Array.from(
        new Set([
          ...(roleAssignmentsRes.data || []).map((row) => row.user_id),
          ...(userCompaniesRes.data || []).map((row) => row.user_id),
          ...(superAdminsRes.data || []).map((row) => row.user_id),
        ].filter(Boolean))
      );

      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      return (profiles || [])
        .map((p) => ({
          id: p.id,
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          email: p.email || "",
        }))
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "sr"));
    },
    enabled: !!selectedCompany?.id,
  });
}
