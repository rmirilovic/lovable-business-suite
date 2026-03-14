import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { useAuth } from "@/contexts/AuthContext";
import { useIncomingMail, DOCUMENT_TYPES, DOCUMENT_TYPE_MAP, IncomingMail } from "@/hooks/useIncomingMail";
import { usePartners, Partner } from "@/hooks/usePartners";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { parseLocaleNumber } from "@/lib/formatting";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (mail: IncomingMail) => void;
}

export function IncomingMailDialog({ open, onOpenChange, onSaved }: Props) {
  const { selectedCompany, selectedYear, user } = useAuth();
  const { createMail, generateMailNumber } = useIncomingMail();
  const { partners } = usePartners();
  const { minDate, maxDate } = useBusinessYearDateLimits();

  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setDocumentType("");
      setDocumentNumber("");
      setDocumentDate(format(new Date(), "yyyy-MM-dd"));
      setPartnerId(null);
      setSenderName("");
      setAmount("");
      setNote("");
    }
  }, [open]);

  // Auto-fill sender info when partner selected
  useEffect(() => {
    if (partnerId) {
      const partner = partners.find((p) => p.id === partnerId);
      if (partner) {
        setSenderName(`${partner.code} - ${partner.name}${partner.city ? ", " + partner.city : ""}`);
      }
    }
  }, [partnerId, partners]);

  const docTypeConfig = documentType ? DOCUMENT_TYPE_MAP[documentType] : null;
  const isFinancial = docTypeConfig?.isFinancial || false;
  const requiresAmount = docTypeConfig?.requiresAmount || false;

  const selectedPartner = partnerId ? partners.find((p) => p.id === partnerId) : null;

  const handleSave = async () => {
    if (!selectedCompany || !selectedYear || !user) return;

    // Validations
    if (!documentType) { toast.error("Izaberite vrstu dokumenta"); return; }
    if (!documentNumber.trim()) { toast.error("Unesite broj dokumenta"); return; }
    if (!documentDate) { toast.error("Unesite datum dokumenta"); return; }
    if (!senderName.trim()) { toast.error("Unesite pošiljaoca"); return; }
    
    // Financial docs require registered partner
    if (isFinancial && !partnerId) {
      toast.error("Za finansijske dokumente pošiljalac mora biti registrovan partner");
      return;
    }

    // Amount required for certain types
    if (requiresAmount && !amount.trim()) {
      toast.error("Unesite iznos dokumenta");
      return;
    }

    const parsedAmount = amount ? parseLocaleNumber(amount) : null;

    // Check for duplicate document number
    const { data: existing } = await supabase
      .from("incoming_mail")
      .select("id")
      .eq("company_id", selectedCompany.id)
      .eq("business_year_id", selectedYear.id)
      .eq("document_type", documentType)
      .eq("document_number", documentNumber.trim())
      .eq(partnerId ? "partner_id" : "sender_name", partnerId || senderName.trim())
      .limit(1);

    if (existing && existing.length > 0) {
      toast.error("Dokument sa istim brojem, vrstom i pošiljaocem već postoji");
      return;
    }

    setIsSubmitting(true);
    try {
      const mailNumber = await generateMailNumber();
      const result = await createMail.mutateAsync({
        company_id: selectedCompany.id,
        business_year_id: selectedYear.id,
        created_by: user.id,
        mail_number: mailNumber,
        document_type: documentType,
        document_number: documentNumber.trim(),
        document_date: documentDate,
        partner_id: partnerId,
        sender_name: senderName.trim(),
        sender_pib: selectedPartner?.pib || null,
        sender_mb: selectedPartner?.mb || null,
        amount: parsedAmount,
        note: note.trim() || null,
        status: "draft",
      } as any);
      onOpenChange(false);
      onSaved(result);
    } catch (e) {
      // error handled by mutation
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novi dokument ulazne pošte</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Vrsta dokumenta *</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger><SelectValue placeholder="Izaberite vrstu..." /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Broj dokumenta *</Label>
              <Input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Datum dokumenta *</Label>
              <LocaleDateInput value={documentDate} onChange={setDocumentDate} minDate={minDate} maxDate={maxDate} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pošiljalac - partner iz šifarnika</Label>
            <SearchablePartnerSelect
              partners={partners.map(p => ({ id: p.id, code: p.code, name: p.name, city: p.city }))}
              value={partnerId || ""}
              onValueChange={(val) => setPartnerId(val || null)}
              placeholder="Izaberite partnera (opciono)..."
            />
          </div>

          <div className="space-y-2">
            <Label>Naziv pošiljaoca *</Label>
            <Input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Unesite naziv pošiljaoca..."
              autoComplete="off"
            />
            {selectedPartner && (
              <p className="text-xs text-muted-foreground">
                PIB: {selectedPartner.pib || "-"} | MB: {selectedPartner.mb || "-"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Iznos{requiresAmount ? " *" : ""}
            </Label>
            <LocaleNumberInput
              value={amount}
              onChange={setAmount}
            />
          </div>

          <div className="space-y-2">
            <Label>Napomena (max 127 karaktera)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 127))}
              maxLength={127}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground text-right">{note.length}/127</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Otkaži</Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Čuvanje..." : "Sačuvaj"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
