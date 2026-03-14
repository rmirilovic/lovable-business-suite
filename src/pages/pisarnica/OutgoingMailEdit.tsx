import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { Loader2, ArrowLeft, History, BookCheck, Undo2, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePartners } from "@/hooks/usePartners";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { useOutgoingMail, DOCUMENT_TYPES, DOCUMENT_TYPE_MAP, STATUS_LABELS, STATUS_VARIANTS, OutgoingMail } from "@/hooks/useOutgoingMail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber, parseLocaleNumber } from "@/lib/formatting";
import { format } from "date-fns";

export default function OutgoingMailEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const { partners } = usePartners();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const { createMail, updateMail, deleteMail, generateMailNumber } = useOutgoingMail();

  const isNew = id === "new";
  const [mail, setMail] = useState<OutgoingMail | null>(null);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Editable fields
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  // Dialogs
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [unregisterDialogOpen, setUnregisterDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const fetchMail = useCallback(async () => {
    if (!id || isNew) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("outgoing_mail")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      toast.error("Dokument nije pronađen");
      navigate("/pisarnica/poslata-posta");
      return;
    }
    const m = data as OutgoingMail;
    setMail(m);
    setDocumentType(m.document_type);
    setDocumentNumber(m.document_number);
    setDocumentDate(m.document_date);
    setPartnerId(m.recipient_partner_id);
    setRecipientName(m.recipient_name);
    setRecipientAddress(m.recipient_address || "");
    setAmount(m.amount != null ? String(m.amount) : "");
    setNote(m.note || "");
    setIsLoading(false);
  }, [id, isNew, navigate]);

  useEffect(() => { fetchMail(); }, [fetchMail]);

  // Initialize new document
  useEffect(() => {
    if (isNew && documentDate === "") {
      setDocumentDate(format(new Date(), "yyyy-MM-dd"));
    }
  }, [isNew, documentDate]);

  // Auto-fill recipient when partner changes
  useEffect(() => {
    if (partnerId && (isNew || mail?.status === "draft")) {
      const partner = partners.find((p) => p.id === partnerId);
      if (partner) {
        setRecipientName(`${partner.code} - ${partner.name}${partner.city ? ", " + partner.city : ""}`);
        const addressParts = [partner.address, partner.postal_code, partner.city].filter(Boolean);
        setRecipientAddress(addressParts.join(", "));
      }
    }
  }, [partnerId, partners, isNew, mail?.status]);

  const isDraft = isNew || mail?.status === "draft";
  const isRegistered = mail?.status === "registered";

  const handleSave = async () => {
    if (!documentType) {
      toast.error("Izaberite vrstu dokumenta");
      return;
    }
    if (!documentDate) {
      toast.error("Unesite datum dokumenta");
      return;
    }

    const parsedAmount = amount ? parseLocaleNumber(amount) : null;

    if (isNew) {
      if (!selectedCompany?.id || !selectedYear?.id || !user?.id) return;
      const mailNumber = await generateMailNumber();
      const result = await createMail.mutateAsync({
        company_id: selectedCompany.id,
        business_year_id: selectedYear.id,
        created_by: user.id,
        mail_number: mailNumber,
        document_type: documentType,
        document_number: documentNumber,
        document_date: documentDate,
        recipient_partner_id: partnerId || null,
        recipient_name: recipientName,
        recipient_address: recipientAddress || null,
        amount: parsedAmount,
        note: note || null,
        status: "draft",
      });
      navigate(`/pisarnica/poslata-posta/${result.id}`, { replace: true });
    } else if (mail) {
      await updateMail.mutateAsync({
        id: mail.id,
        document_type: documentType,
        document_number: documentNumber,
        document_date: documentDate,
        recipient_partner_id: partnerId || null,
        recipient_name: recipientName,
        recipient_address: recipientAddress || null,
        amount: parsedAmount,
        note: note || null,
      } as any);
      await fetchMail();
    }
  };

  const handleRegister = async () => {
    if (!mail) return;
    if (!documentType || !documentDate) {
      toast.error("Popunite obavezna polja pre zavođenja");
      return;
    }
    const parsedAmount = amount ? parseLocaleNumber(amount) : null;
    await updateMail.mutateAsync({
      id: mail.id,
      document_type: documentType,
      document_number: documentNumber,
      document_date: documentDate,
      recipient_partner_id: partnerId || null,
      recipient_name: recipientName,
      recipient_address: recipientAddress || null,
      amount: parsedAmount,
      note: note || null,
      status: "registered",
      registration_date: format(new Date(), "yyyy-MM-dd"),
    } as any);
    setRegisterDialogOpen(false);
    await fetchMail();
  };

  const handleUnregister = async () => {
    if (!mail) return;
    await updateMail.mutateAsync({
      id: mail.id,
      status: "draft",
      registration_date: null,
    } as any);
    setUnregisterDialogOpen(false);
    await fetchMail();
  };

  const handleDelete = async () => {
    if (!mail) return;
    await deleteMail.mutateAsync(mail.id);
    setDeleteDialogOpen(false);
    navigate("/pisarnica/poslata-posta");
  };

  if (isLoading) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const currentStatus = isNew ? "draft" : mail?.status || "draft";

  return (
    <MainLayout title={isNew ? "Novi dokument poslate pošte" : `Dokument ${mail?.mail_number}`}>
      <div className="space-y-6 animate-fade-in max-w-4xl">
        {/* Header toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/pisarnica/poslata-posta")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isNew ? "Novi dokument" : `Dokument ${mail?.mail_number}`}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant={STATUS_VARIANTS[currentStatus] || "secondary"}
                  className={cn(
                    currentStatus === "registered" && "bg-blue-800 text-white hover:bg-blue-900"
                  )}
                >
                  {STATUS_LABELS[currentStatus] || currentStatus}
                </Badge>
                {mail?.registration_date && (
                  <span className="text-xs text-muted-foreground">
                    Zavedeno: {formatDate(mail.registration_date)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="ghost" size="icon" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
                <History className="w-5 h-5" />
              </Button>
            )}
            {isDraft && (
              <>
                <Button variant="outline" onClick={handleSave} disabled={createMail.isPending || updateMail.isPending}>
                  {(createMail.isPending || updateMail.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sačuvaj izmene
                </Button>
                {!isNew && (
                  <>
                    <Button onClick={() => setRegisterDialogOpen(true)}>
                      <BookCheck className="w-4 h-4 mr-2" />Zavedi dokument
                    </Button>
                    <Button
                      variant="outline"
                      className="text-destructive border-destructive/50 hover:bg-destructive/10"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />Obriši
                    </Button>
                  </>
                )}
              </>
            )}
            {isRegistered && (
              <Button
                variant="outline"
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={() => setUnregisterDialogOpen(true)}
              >
                <Undo2 className="w-4 h-4 mr-2" />Vrati u nacrt
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Vrsta dokumenta *</Label>
            <Select value={documentType} onValueChange={setDocumentType} disabled={!isDraft}>
              <SelectTrigger>
                <SelectValue placeholder="Izaberite vrstu..." />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Broj dokumenta</Label>
            <Input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              disabled={!isDraft}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label>Datum dokumenta *</Label>
            <LocaleDateInput
              value={documentDate}
              onChange={setDocumentDate}
              disabled={!isDraft}
              minDate={minDate}
              maxDate={maxDate}
            />
          </div>

          <div className="space-y-2">
            <Label>Primalac (partner)</Label>
            <SearchablePartnerSelect
              value={partnerId || ""}
              onValueChange={(v) => setPartnerId(v || null)}
              partners={partners}
              disabled={!isDraft}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Primalac - naziv</Label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              disabled={!isDraft}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Adresa primaoca</Label>
            <Input
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              disabled={!isDraft}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label>Iznos</Label>
            <LocaleNumberInput
              value={amount}
              onChange={setAmount}
              disabled={!isDraft}
              decimalPlaces={2}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Napomena</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!isDraft}
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Register dialog */}
      <AlertDialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zavođenje dokumenta</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da zavedete dokument {mail?.mail_number}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegister}>Zavedi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unregister dialog */}
      <AlertDialog open={unregisterDialogOpen} onOpenChange={setUnregisterDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništavanje zavođenja</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da vratite dokument {mail?.mail_number} u nacrt?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnregister} className="bg-destructive text-destructive-foreground">
              Vrati u nacrt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje dokumenta</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete dokument {mail?.mail_number}? Ova akcija se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History dialog */}
      {mail && (
        <DocumentHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          documentId={mail.id}
          documentName={mail.mail_number}
          documentType="outgoing_mail"
        />
      )}
    </MainLayout>
  );
}
