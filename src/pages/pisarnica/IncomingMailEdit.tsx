import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, ArrowLeft, RefreshCw, History, Paperclip, Eye, Trash2, Upload, BookCheck, Undo2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePartners } from "@/hooks/usePartners";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { useIncomingMail, DOCUMENT_TYPES, DOCUMENT_TYPE_MAP, STATUS_LABELS, STATUS_VARIANTS, IncomingMail, useCompanyUsers } from "@/hooks/useIncomingMail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/formatting";
import { format } from "date-fns";

export default function IncomingMailEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany, selectedYear, user } = useAuth();
  const { partners } = usePartners();
  const { minDate, maxDate } = useBusinessYearDateLimits();
  const { updateMail } = useIncomingMail();
  const { data: companyUsers = [] } = useCompanyUsers();

  const [mail, setMail] = useState<IncomingMail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Editable fields
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isCorrect, setIsCorrect] = useState(true);
  const [incorrectReason, setIncorrectReason] = useState("");
  const [liquidatorUserId, setLiquidatorUserId] = useState("");
  const [liquidatorName, setLiquidatorName] = useState("");

  // Dialogs
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const fetchMail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("incoming_mail")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      toast.error("Dokument nije pronađen");
      navigate("/pisarnica/zavodjenje");
      return;
    }
    const m = data as IncomingMail;
    setMail(m);
    setDocumentType(m.document_type);
    setDocumentNumber(m.document_number);
    setDocumentDate(m.document_date);
    setPartnerId(m.partner_id);
    setSenderName(m.sender_name);
    setAmount(m.amount != null ? String(m.amount) : "");
    setNote(m.note || "");
    setIsCorrect(m.is_correct);
    setIncorrectReason(m.incorrect_reason || "");
    setLiquidatorUserId(m.liquidator_user_id || "");
    setLiquidatorName(m.liquidator_name || "");
    setIsLoading(false);
  }, [id, navigate]);

  useEffect(() => { fetchMail(); }, [fetchMail]);

  // Auto-fill sender when partner changes
  useEffect(() => {
    if (partnerId && mail?.status === "draft") {
      const partner = partners.find((p) => p.id === partnerId);
      if (partner) {
        setSenderName(`${partner.code} - ${partner.name}${partner.city ? ", " + partner.city : ""}`);
      }
    }
  }, [partnerId, partners, mail?.status]);

  // Auto-fill liquidator name
  useEffect(() => {
    if (liquidatorUserId) {
      const u = companyUsers.find((cu) => cu.id === liquidatorUserId);
      if (u) setLiquidatorName(`${u.first_name} ${u.last_name}`.trim() || u.email);
    } else {
      setLiquidatorName("");
    }
  }, [liquidatorUserId, companyUsers]);

  const isDraft = mail?.status === "draft";
  const isRegistered = mail?.status === "registered";
  const docTypeConfig = documentType ? DOCUMENT_TYPE_MAP[documentType] : null;
  const isFinancial = docTypeConfig?.isFinancial || false;
  const requiresAmount = docTypeConfig?.requiresAmount || false;
  const selectedPartner = partnerId ? partners.find((p) => p.id === partnerId) : null;

  const handleSave = async () => {
    if (!mail || !isDraft) return;
    if (!documentType || !documentNumber.trim() || !documentDate || !senderName.trim()) {
      toast.error("Popunite sva obavezna polja");
      return;
    }
    if (isFinancial && !partnerId) {
      toast.error("Za finansijske dokumente pošiljalac mora biti registrovan partner");
      return;
    }
    if (requiresAmount && !amount.trim()) {
      toast.error("Unesite iznos dokumenta");
      return;
    }
    const parsedAmount = amount ? parseFloat(amount.replace(/[^\d.-]/g, "")) : null;

    await updateMail.mutateAsync({
      id: mail.id,
      document_type: documentType,
      document_number: documentNumber.trim(),
      document_date: documentDate,
      partner_id: partnerId,
      sender_name: senderName.trim(),
      sender_pib: selectedPartner?.pib || null,
      sender_mb: selectedPartner?.mb || null,
      amount: parsedAmount,
      note: note.trim() || null,
      is_correct: isCorrect,
      incorrect_reason: !isCorrect ? incorrectReason.trim() : null,
    } as any);
    fetchMail();
  };

  const handleRegister = async () => {
    if (!mail) return;
    if (!isCorrect) {
      toast.error("Dokument mora biti označen kao ispravan");
      return;
    }
    if (!liquidatorUserId) {
      toast.error("Izaberite likvidatora");
      return;
    }

    await updateMail.mutateAsync({
      id: mail.id,
      document_type: documentType,
      document_number: documentNumber.trim(),
      document_date: documentDate,
      partner_id: partnerId,
      sender_name: senderName.trim(),
      sender_pib: selectedPartner?.pib || null,
      sender_mb: selectedPartner?.mb || null,
      amount: amount ? parseFloat(amount.replace(/[^\d.-]/g, "")) : null,
      note: note.trim() || null,
      is_correct: isCorrect,
      liquidator_user_id: liquidatorUserId,
      liquidator_name: liquidatorName,
      status: "registered",
      registration_date: format(new Date(), "yyyy-MM-dd"),
    } as any);
    setRegisterDialogOpen(false);
    fetchMail();
  };

  const handleCancel = async () => {
    if (!mail) return;
    if (cancelReason.trim().length < 10) {
      toast.error("Obrazloženje storniranja mora imati najmanje 10 karaktera");
      return;
    }
    await updateMail.mutateAsync({
      id: mail.id,
      status: "cancelled",
      incorrect_reason: cancelReason.trim(),
      is_correct: false,
    } as any);
    setCancelDialogOpen(false);
    fetchMail();
  };

  // Attachment handlers
  const handleUploadAttachment = async (file: File) => {
    if (!mail || !selectedCompany) return;
    const path = `${selectedCompany.id}/${mail.id}/${file.name}`;
    const { error } = await supabase.storage
      .from("mail-attachments")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Greška pri upload-u: " + error.message);
      return;
    }
    await updateMail.mutateAsync({
      id: mail.id,
      attachment_path: path,
      attachment_name: file.name,
    } as any);
    fetchMail();
    toast.success("Prilog dodat");
  };

  const handleViewAttachment = async () => {
    if (!mail?.attachment_path) return;
    const { data } = await supabase.storage
      .from("mail-attachments")
      .createSignedUrl(mail.attachment_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  };

  const handleDeleteAttachment = async () => {
    if (!mail?.attachment_path) return;
    await supabase.storage
      .from("mail-attachments")
      .remove([mail.attachment_path]);
    await updateMail.mutateAsync({
      id: mail.id,
      attachment_path: null,
      attachment_name: null,
    } as any);
    fetchMail();
    toast.success("Prilog obrisan");
  };

  if (isLoading || !mail) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={`Pošta: ${mail.mail_number}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/pisarnica/zavodjenje")}>
              <ArrowLeft className="w-4 h-4 mr-2" />Nazad
            </Button>
            <h1 className="text-xl font-semibold">Dokument {mail.mail_number}</h1>
            <Badge
              variant={STATUS_VARIANTS[mail.status] || "secondary"}
              className={cn(
                mail.status === "liquidated" && "bg-blue-800 text-white hover:bg-blue-900"
              )}
            >
              {STATUS_LABELS[mail.status] || mail.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchMail} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isDraft && (
              <Button variant="outline" size="sm" onClick={handleSave}>
                Sačuvaj izmene
              </Button>
            )}
          </div>
        </div>

        {/* Read-only header info for non-draft */}
        {!isDraft && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
            <div>
              <div className="text-muted-foreground">Vrsta dokumenta</div>
              <div className="font-medium">{DOCUMENT_TYPE_MAP[mail.document_type]?.label || mail.document_type}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Broj dokumenta</div>
              <div className="font-medium">{mail.document_number}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Datum dokumenta</div>
              <div className="font-medium">{formatDate(mail.document_date)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Pošiljalac</div>
              <div className="font-medium">{mail.sender_name}</div>
            </div>
            {mail.sender_pib && (
              <div>
                <div className="text-muted-foreground">PIB</div>
                <div className="font-medium">{mail.sender_pib}</div>
              </div>
            )}
            {mail.sender_mb && (
              <div>
                <div className="text-muted-foreground">Matični broj</div>
                <div className="font-medium">{mail.sender_mb}</div>
              </div>
            )}
            {mail.amount != null && (
              <div>
                <div className="text-muted-foreground">Iznos</div>
                <div className="font-medium">{formatNumber(mail.amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            )}
            {mail.note && (
              <div className="col-span-2">
                <div className="text-muted-foreground">Napomena</div>
                <div className="font-medium">{mail.note}</div>
              </div>
            )}
            {mail.registration_date && (
              <div>
                <div className="text-muted-foreground">Datum zavođenja</div>
                <div className="font-medium">{formatDate(mail.registration_date)}</div>
              </div>
            )}
            {mail.liquidator_name && (
              <div>
                <div className="text-muted-foreground">Likvidator</div>
                <div className="font-medium">{mail.liquidator_name}</div>
              </div>
            )}
            {mail.archive_label && (
              <div>
                <div className="text-muted-foreground">Oznaka arhive</div>
                <div className="font-medium">{mail.archive_label}</div>
              </div>
            )}
            {mail.cost_center_distribution && (
              <div>
                <div className="text-muted-foreground">Raspored po MT</div>
                <div className="font-medium">{mail.cost_center_distribution}</div>
              </div>
            )}
            {mail.liquidation_date && (
              <div>
                <div className="text-muted-foreground">Datum likvidacije</div>
                <div className="font-medium">{formatDate(mail.liquidation_date)}</div>
              </div>
            )}
          </div>
        )}

        {/* Editable form for draft */}
        {isDraft && (
          <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vrsta dokumenta *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label>Datum dokumenta *</Label>
                  <LocaleDateInput value={documentDate} onChange={setDocumentDate} minDate={minDate} maxDate={maxDate} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Partner iz šifarnika</Label>
              <SearchablePartnerSelect
                partners={partners.map(p => ({ id: p.id, code: p.code, name: p.name, city: p.city }))}
                value={partnerId || ""}
                onValueChange={(val) => setPartnerId(val || null)}
              />
            </div>

            <div className="space-y-2">
              <Label>Naziv pošiljaoca *</Label>
              <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} autoComplete="off" />
              {selectedPartner && (
                <p className="text-xs text-muted-foreground">
                  PIB: {selectedPartner.pib || "-"} | MB: {selectedPartner.mb || "-"}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Iznos{requiresAmount ? " *" : ""}</Label>
                <LocaleNumberInput value={amount} onChange={setAmount} />
              </div>
              <div className="space-y-2">
                <Label>Napomena (max 127)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 127))} maxLength={127} autoComplete="off" />
              </div>
            </div>

            <Separator />

            {/* Attachment section */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Prilog</Label>
              <div className="flex items-center gap-2">
                {!mail.attachment_path ? (
                  <Button variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <Upload className="w-4 h-4 mr-2" />Dodaj prilog
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadAttachment(file);
                        }}
                      />
                    </label>
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={handleViewAttachment}>
                      <Eye className="w-4 h-4 mr-2" />Vidi prilog
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDeleteAttachment} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />Briši prilog
                    </Button>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Paperclip className="w-3 h-3" />{mail.attachment_name}
                    </span>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {/* Correctness & Registration section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_correct"
                  checked={isCorrect}
                  onCheckedChange={(checked) => setIsCorrect(!!checked)}
                />
                <Label htmlFor="is_correct" className="font-medium">Dokument je ispravan</Label>
              </div>

              {!isCorrect && (
                <div className="space-y-2 ml-6">
                  <Label>Zašto je dokument neispravan? *</Label>
                  <Textarea
                    value={incorrectReason}
                    onChange={(e) => setIncorrectReason(e.target.value)}
                    placeholder="Obrazložite zašto je dokument neispravan..."
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setCancelReason(incorrectReason);
                      setCancelDialogOpen(true);
                    }}
                    disabled={incorrectReason.trim().length < 10}
                  >
                    Storniraj dokument
                  </Button>
                </div>
              )}

              {isCorrect && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label>Prosleđuje se na likvidaciju: *</Label>
                    <Select value={liquidatorUserId} onValueChange={setLiquidatorUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Izaberite likvidatora..." />
                      </SelectTrigger>
                      <SelectContent>
                        {companyUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.first_name} {u.last_name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setRegisterDialogOpen(true)}
                    disabled={!liquidatorUserId || !isCorrect}
                  >
                    <BookCheck className="w-4 h-4 mr-2" />Zavedi dokument
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attachment view for non-draft */}
        {!isDraft && mail.attachment_path && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleViewAttachment}>
              <Eye className="w-4 h-4 mr-2" />Vidi prilog
            </Button>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Paperclip className="w-3 h-3" />{mail.attachment_name}
            </span>
          </div>
        )}
      </div>

      {/* Register confirmation */}
      <AlertDialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zavođenje dokumenta</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da zavedete dokument {mail.mail_number}?
              Zavedeni dokument se više ne može menjati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegister}>Zavedi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Storniranje dokumenta</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da stornirate dokument {mail.mail_number}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground">
              Storniraj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DocumentHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        documentId={mail.id}
        documentName={mail.mail_number}
        documentType="incoming_mail"
      />
    </MainLayout>
  );
}
