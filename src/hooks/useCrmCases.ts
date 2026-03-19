import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const CRM_STATUSES = [
  { value: "draft", label: "Nacrt" },
  { value: "assigned", label: "Dodeljen" },
  { value: "in_progress", label: "U obradi" },
  { value: "closed", label: "Zaključen" },
] as const;

export const CRM_STATUS_MAP: Record<string, string> = Object.fromEntries(
  CRM_STATUSES.map((s) => [s.value, s.label])
);

export const CRM_STATUS_VARIANTS: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  draft: "secondary",
  assigned: "outline",
  in_progress: "default",
  closed: "destructive",
};

export const CRM_PRIORITIES = [
  { value: "low", label: "Nizak" },
  { value: "normal", label: "Normalan" },
  { value: "high", label: "Visok" },
  { value: "urgent", label: "Hitan" },
] as const;

export const COMMUNICATION_TYPES = [
  { value: "visit_outgoing", label: "Poseta (odlazna)" },
  { value: "visit_incoming", label: "Poseta (dolazna)" },
  { value: "phone", label: "Telefon" },
  { value: "email", label: "E-mail" },
  { value: "other", label: "Drugi način" },
] as const;

export interface CrmCase {
  id: string;
  company_id: string;
  case_number: string;
  crm_type_id: string;
  subject: string;
  description: string | null;
  partner_id: string | null;
  contact_person: string | null;
  priority: string;
  status: string;
  close_reason: string | null;
  deadline: string | null;
  owner_user_id: string;
  assigned_user_id: string | null;
  assigned_department: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrmWorkflow {
  id: string;
  case_id: string;
  company_id: string;
  action_type: string;
  from_status: string | null;
  to_status: string | null;
  from_user_id: string | null;
  to_user_id: string | null;
  to_department: string | null;
  note: string | null;
  performed_by: string;
  performed_at: string;
}

export interface CrmCommunication {
  id: string;
  case_id: string;
  company_id: string;
  communication_type: string;
  contact_person: string | null;
  summary: string;
  next_steps: string | null;
  communication_date: string;
  created_by: string;
  created_at: string;
}

export interface CrmDocument {
  id: string;
  case_id: string;
  communication_id: string | null;
  company_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: string | null;
  description: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

const fromCrm = (table: string) => (supabase.from as any)(table);

export function useCrmCases(statusFilter?: string) {
  const { selectedCompany } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["crm-cases", selectedCompany?.id, statusFilter],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      let q = fromCrm("crm_cases")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("created_at", { ascending: false });
      if (statusFilter && statusFilter !== "__all__") {
        q = q.eq("status", statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as CrmCase[];
    },
    enabled: !!selectedCompany?.id,
  });

  const createCase = useMutation({
    mutationFn: async (values: Partial<CrmCase>) => {
      if (!selectedCompany?.id || !selectedYear?.id) throw new Error("No company/year");
      const { data: maxNum } = await fromCrm("crm_cases")
        .select("case_number")
        .eq("company_id", selectedCompany.id)
        .eq("business_year_id", selectedYear.id)
        .order("case_number", { ascending: false })
        .limit(1);
      
      const lastNum = maxNum?.[0]?.case_number;
      const nextNum = lastNum 
        ? String(parseInt(lastNum.replace(/\D/g, "") || "0") + 1).padStart(4, "0")
        : "0001";
      const caseNumber = `CRM-${nextNum}`;

      const { data, error } = await fromCrm("crm_cases").insert({
        ...values,
        company_id: selectedCompany.id,
        business_year_id: selectedYear.id,
        case_number: caseNumber,
        status: "draft",
      }).select().single();
      if (error) throw error;

      // Add workflow entry
      await fromCrm("crm_workflow").insert({
        case_id: data.id,
        company_id: selectedCompany.id,
        action_type: "created",
        to_status: "draft",
        performed_by: values.created_by!,
      });

      return data as CrmCase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-cases"] });
      toast.success("Predmet kreiran");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateCase = useMutation({
    mutationFn: async (values: Partial<CrmCase> & { id: string }) => {
      const { id, ...rest } = values;
      const { error } = await fromCrm("crm_cases").update({
        ...rest,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-cases"] });
      queryClient.invalidateQueries({ queryKey: ["crm-case"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromCrm("crm_cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-cases"] });
      toast.success("Predmet obrisan");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    cases: query.data || [],
    isLoading: query.isLoading,
    createCase,
    updateCase,
    deleteCase,
  };
}

export function useCrmCaseDetail(caseId: string | undefined) {
  const caseQuery = useQuery({
    queryKey: ["crm-case", caseId],
    queryFn: async () => {
      if (!caseId) return null;
      const { data, error } = await fromCrm("crm_cases")
        .select("*")
        .eq("id", caseId)
        .single();
      if (error) throw error;
      return data as CrmCase;
    },
    enabled: !!caseId,
  });

  const workflowQuery = useQuery({
    queryKey: ["crm-workflow", caseId],
    queryFn: async () => {
      if (!caseId) return [];
      const { data, error } = await fromCrm("crm_workflow")
        .select("*")
        .eq("case_id", caseId)
        .order("performed_at", { ascending: true });
      if (error) throw error;
      return data as CrmWorkflow[];
    },
    enabled: !!caseId,
  });

  const communicationsQuery = useQuery({
    queryKey: ["crm-communications", caseId],
    queryFn: async () => {
      if (!caseId) return [];
      const { data, error } = await fromCrm("crm_communications")
        .select("*")
        .eq("case_id", caseId)
        .order("communication_date", { ascending: false });
      if (error) throw error;
      return data as CrmCommunication[];
    },
    enabled: !!caseId,
  });

  const documentsQuery = useQuery({
    queryKey: ["crm-documents", caseId],
    queryFn: async () => {
      if (!caseId) return [];
      const { data, error } = await fromCrm("crm_documents")
        .select("*")
        .eq("case_id", caseId)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data as CrmDocument[];
    },
    enabled: !!caseId,
  });

  return {
    crmCase: caseQuery.data,
    isLoading: caseQuery.isLoading,
    workflow: workflowQuery.data || [],
    communications: communicationsQuery.data || [],
    documents: documentsQuery.data || [],
  };
}

export function useCrmActions() {
  const { selectedCompany, user } = useAuth();
  const queryClient = useQueryClient();

  const addWorkflowEntry = async (entry: Partial<CrmWorkflow>) => {
    if (!selectedCompany?.id) return;
    await fromCrm("crm_workflow").insert({
      ...entry,
      company_id: selectedCompany.id,
      performed_by: user?.id || entry.performed_by!,
    });
    queryClient.invalidateQueries({ queryKey: ["crm-workflow"] });
  };

  const assignCase = useMutation({
    mutationFn: async (values: { caseId: string; userId: string; department?: string; deadline?: string }) => {
      if (!selectedCompany?.id || !user?.id) throw new Error("No company/user");
      
      const { error } = await fromCrm("crm_cases").update({
        assigned_user_id: values.userId,
        assigned_department: values.department || null,
        deadline: values.deadline || null,
        status: "assigned",
        updated_at: new Date().toISOString(),
      }).eq("id", values.caseId);
      if (error) throw error;

      await addWorkflowEntry({
        case_id: values.caseId,
        action_type: "assigned",
        to_status: "assigned",
        to_user_id: values.userId,
        to_department: values.department,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-cases"] });
      queryClient.invalidateQueries({ queryKey: ["crm-case"] });
      toast.success("Predmet dodeljen");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pickUpCase = useMutation({
    mutationFn: async (caseId: string) => {
      if (!user?.id) throw new Error("No user");
      const { error } = await fromCrm("crm_cases").update({
        status: "in_progress",
        updated_at: new Date().toISOString(),
      }).eq("id", caseId);
      if (error) throw error;

      await addWorkflowEntry({
        case_id: caseId,
        action_type: "picked_up",
        from_status: "assigned",
        to_status: "in_progress",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-cases"] });
      queryClient.invalidateQueries({ queryKey: ["crm-case"] });
      toast.success("Predmet preuzet u obradu");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeCase = useMutation({
    mutationFn: async (values: { caseId: string; reason: string }) => {
      if (!user?.id) throw new Error("No user");
      const { error } = await fromCrm("crm_cases").update({
        status: "closed",
        close_reason: values.reason,
        updated_at: new Date().toISOString(),
      }).eq("id", values.caseId);
      if (error) throw error;

      await addWorkflowEntry({
        case_id: values.caseId,
        action_type: "status_change",
        to_status: "closed",
        note: values.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-cases"] });
      queryClient.invalidateQueries({ queryKey: ["crm-case"] });
      toast.success("Predmet zaključen");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addCommunication = useMutation({
    mutationFn: async (values: Partial<CrmCommunication>) => {
      if (!selectedCompany?.id || !user?.id) throw new Error("No company/user");
      const { data, error } = await fromCrm("crm_communications").insert({
        ...values,
        company_id: selectedCompany.id,
        created_by: user.id,
      }).select().single();
      if (error) throw error;
      return data as CrmCommunication;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-communications"] });
      toast.success("Komunikacija dodana");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCommunication = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromCrm("crm_communications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-communications"] });
      toast.success("Komunikacija obrisana");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadDocument = useMutation({
    mutationFn: async (values: { caseId: string; file: File; description?: string; communicationId?: string }) => {
      if (!selectedCompany?.id || !user?.id) throw new Error("No company/user");
      const path = `${selectedCompany.id}/${values.caseId}/${Date.now()}_${values.file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("crm-documents")
        .upload(path, values.file);
      if (uploadError) throw uploadError;

      const { error } = await fromCrm("crm_documents").insert({
        case_id: values.caseId,
        communication_id: values.communicationId || null,
        company_id: selectedCompany.id,
        file_name: values.file.name,
        file_path: path,
        file_size: values.file.size,
        file_type: values.file.type,
        description: values.description || null,
        uploaded_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-documents"] });
      toast.success("Dokument otpremljen");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDocument = useMutation({
    mutationFn: async (doc: CrmDocument) => {
      await supabase.storage.from("crm-documents").remove([doc.file_path]);
      const { error } = await fromCrm("crm_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-documents"] });
      toast.success("Dokument obrisan");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    assignCase,
    pickUpCase,
    closeCase,
    addCommunication,
    deleteCommunication,
    uploadDocument,
    deleteDocument,
  };
}
