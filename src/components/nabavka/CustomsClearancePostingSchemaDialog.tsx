import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { SearchableAccountInput } from "@/components/ui/searchable-account-input";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomsClearancePostingSchemaDialog({ open, onOpenChange }: Props) {
  const { selectedCompany } = useAuth();
  const { data: chartOfAccounts = [] } = useChartOfAccounts();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const [customsDutyAccount, setCustomsDutyAccount] = useState("");
  const [customsObligationAccount, setCustomsObligationAccount] = useState("");
  const [exciseAccount, setExciseAccount] = useState("");
  const [vatAccount, setVatAccount] = useState("2700");

  const accountsList = useMemo(
    () => chartOfAccounts.filter((a) => a.is_posting_allowed).map((a) => ({ code: a.code, name: a.name })),
    [chartOfAccounts]
  );

  useEffect(() => {
    if (!open || !selectedCompany?.id) return;
    setIsLoading(true);

    (async () => {
      const { data, error } = await (supabase as any)
        .from("customs_clearance_posting_schema")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .maybeSingle();

      if (data) {
        setExistingId(data.id);
        setCustomsDutyAccount(data.customs_duty_account || "");
        setCustomsObligationAccount(data.customs_obligation_account || "");
        setExciseAccount(data.excise_account || "");
        setVatAccount(data.vat_account || "2700");
      } else {
        setExistingId(null);
        setCustomsDutyAccount("");
        setCustomsObligationAccount("");
        setExciseAccount("");
        setVatAccount("2700");
      }
      setIsLoading(false);
    })();
  }, [open, selectedCompany?.id]);

  const handleSave = async () => {
    if (!selectedCompany?.id) return;
    setIsSaving(true);
    try {
      const payload = {
        company_id: selectedCompany.id,
        customs_duty_account: customsDutyAccount || null,
        customs_obligation_account: customsObligationAccount || null,
        excise_account: exciseAccount || null,
        vat_account: vatAccount || null,
        updated_at: new Date().toISOString(),
      };

      if (existingId) {
        const { error } = await (supabase as any)
          .from("customs_clearance_posting_schema")
          .update(payload)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("customs_clearance_posting_schema")
          .insert(payload);
        if (error) throw error;
      }

      toast.success("Šema knjiženja sačuvana");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Greška: ${e.message}`);
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Šema knjiženja - Carinski obračun</DialogTitle>
          <DialogDescription>
            Definišite podrazumevana konta koja se koriste pri knjiženju carinskog obračuna u glavnu knjigu.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Carina</Label>
              <SearchableAccountInput
                value={customsDutyAccount}
                onChange={setCustomsDutyAccount}
                accounts={accountsList}
                placeholder="npr. 1329"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Obaveze prema carini</Label>
              <SearchableAccountInput
                value={customsObligationAccount}
                onChange={setCustomsObligationAccount}
                accounts={accountsList}
                placeholder="npr. 4390"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Akciza</Label>
              <SearchableAccountInput
                value={exciseAccount}
                onChange={setExciseAccount}
                accounts={accountsList}
                placeholder="npr. 1329"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">PDV</Label>
              <SearchableAccountInput
                value={vatAccount}
                onChange={setVatAccount}
                accounts={accountsList}
                placeholder="npr. 2700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Zatvori</Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Sačuvaj
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
