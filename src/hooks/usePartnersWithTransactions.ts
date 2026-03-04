import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePartnersWithTransactions() {
  const { selectedCompany, selectedYear } = useAuth();

  return useQuery({
    queryKey: ["partners-with-transactions", selectedCompany?.id, selectedYear?.id],
    queryFn: async () => {
      if (!selectedCompany?.id || !selectedYear?.id) return [];

      const { data, error } = await supabase
        .from("journal_entry_items")
        .select(`
          partner_id,
          partners!inner(id, code, name, city)
        `)
        .not("partner_id", "is", null)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.business_year_id", selectedYear.id);

      // The above nested filter on journal_entries won't work via foreign key.
      // Use a raw RPC or a different approach. Let's use a direct query instead.

      // Actually, let's query via journal_entries first
      const { data: items, error: err } = await supabase
        .from("journal_entry_items")
        .select(`
          partner_id,
          journal_entries!inner(status, business_year_id)
        `)
        .not("partner_id", "is", null)
        .eq("journal_entries.status", "posted")
        .eq("journal_entries.business_year_id", selectedYear.id);

      if (err) throw err;

      // Get unique partner IDs
      const partnerIds = [...new Set((items || []).map((i: any) => i.partner_id).filter(Boolean))];

      if (partnerIds.length === 0) return [];

      // Fetch partner details - handle batching for large sets
      const allPartners: any[] = [];
      const batchSize = 100;
      for (let i = 0; i < partnerIds.length; i += batchSize) {
        const batch = partnerIds.slice(i, i + batchSize);
        const { data: pData, error: pErr } = await supabase
          .from("partners")
          .select("id, code, name, city, pib, mb")
          .eq("company_id", selectedCompany.id)
          .in("id", batch)
          .order("code");

        if (pErr) throw pErr;
        if (pData) allPartners.push(...pData);
      }

      // Sort all by code
      allPartners.sort((a, b) => a.code.localeCompare(b.code));

      return allPartners as { id: string; code: string; name: string; city: string | null; pib: string | null; mb: string | null }[];
    },
    enabled: !!selectedCompany?.id && !!selectedYear?.id,
  });
}
