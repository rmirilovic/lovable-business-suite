import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import {
  ArrowLeft, Save, UserPlus, Play, XCircle, Upload, Trash2, Download,
  MessageSquare, Clock, FileText, Plus, Loader2, Users, Phone, Mail,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePartners, usePartnerContacts } from "@/hooks/usePartners";
import { useCrmTypes } from "@/hooks/useCrmTypes";
import { useIncomingMail } from "@/hooks/useIncomingMail";
import {
  useCrmCaseDetail, useCrmActions, useCrmCases,
  CRM_STATUS_MAP, CRM_STATUS_VARIANTS, CRM_PRIORITIES,
  COMMUNICATION_TYPES, CrmDocument,
} from "@/hooks/useCrmCases";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Company users hook (reuse from incoming mail pattern)
function useCompanyUsers() {
  const { selectedCompany } = useAuth();
  return { data: [] as { id: string; email: string }[] };
}

export default function PredmetEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, selectedCompany } = useAuth();
  const { partners } = usePartners();
  const { types } = useCrmTypes();
  const { crmCase, isLoading, workflow, communications, documents } = useCrmCaseDetail(id);
  const { assignCase, pickUpCase, closeCase, addCommunication, deleteCommunication, uploadDocument, deleteDocument } = useCrmActions();
  const { updateCase } = useCrmCases();

  // Form state
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [typeId, setTypeId] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const { contacts: partnerContacts } = usePartnerContacts(partnerId);
  const [priority, setPriority] = useState("normal");
  const [deadline, setDeadline] = useState("");
  const [contactPerson, setContactPerson] = useState("");

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignDeadline, setAssignDeadline] = useState("");

  // Close dialog
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  // Communication form
  const [commType, setCommType] = useState("phone");
  const [commContact, setCommContact] = useState("");
  const [commSummary, setCommSummary] = useState("");
  const [commNextSteps, setCommNextSteps] = useState("");
  const [commDate, setCommDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Document upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docDescription, setDocDescription] = useState("");

  // Users list for assignment - combine from role assignments and user_companies
  const [companyUsers, setCompanyUsers] = useState<{ id: string; email: string; first_name: string | null; last_name: string | null }[]>([]);
  useEffect(() => {
    if (!selectedCompany?.id) return;
    const fetchUsers = async () => {
      const userIds = new Set<string>();

      // Collect user IDs from role assignments
      const { data: raData } = await supabase
        .from("user_role_assignments")
        .select("user_id")
        .eq("company_id", selectedCompany.id);
      raData?.forEach((d: any) => userIds.add(d.user_id));

      // Collect user IDs from user_companies
      const { data: ucData } = await supabase
        .from("user_companies")
        .select("user_id")
        .eq("company_id", selectedCompany.id);
      ucData?.forEach((d: any) => userIds.add(d.user_id));

      if (userIds.size === 0) {
        setCompanyUsers([]);
        return;
      }

      // Fetch profiles for all collected user IDs
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", Array.from(userIds));

      if (profiles) {
        setCompanyUsers(profiles.map((p: any) => ({
          id: p.id,
          email: p.email,
          first_name: p.first_name,
          last_name: p.last_name,
        })));
      }
    };
    fetchUsers();
  }, [selectedCompany?.id]);

  // Populate form when case loads
  useEffect(() => {
    if (!crmCase) return;
    setSubject(crmCase.subject);
    setDescription(crmCase.description || "");
    setTypeId(crmCase.crm_type_id);
    setPartnerId(crmCase.partner_id);
    setPriority(crmCase.priority);
    setDeadline(crmCase.deadline ? crmCase.deadline.slice(0, 10) : "");
    setContactPerson(crmCase.contact_person || "");
  }, [crmCase]);

  if (isLoading) {
    return (
      <MainLayout title="Predmet">
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!crmCase) {
    return (
      <MainLayout title="Predmet">
        <div className="text-center p-12 text-muted-foreground">Predmet nije pronađen</div>
      </MainLayout>
    );
  }

  const isClosed = crmCase.status === "closed";
  const isOwner = crmCase.owner_user_id === user?.id;
  const isAssignee = crmCase.assigned_to === user?.id;
  const typeObj = types.find((t) => t.id === crmCase.crm_type_id);

  const handleSave = async () => {
    await updateCase.mutateAsync({
      id: crmCase.id,
      subject,
      description: description || null,
      crm_type_id: typeId,
      partner_id: partnerId,
      priority,
      deadline: deadline ? `${deadline}T23:59:59` : null,
      contact_person: contactPerson || null,
    });
    toast.success("Predmet sačuvan");
  };

  const handleAssign = async () => {
    if (!assignUserId) return;
    await assignCase.mutateAsync({
      caseId: crmCase.id,
      userId: assignUserId,
      deadline: assignDeadline ? `${assignDeadline}T23:59:59` : undefined,
    });
    setAssignOpen(false);
  };

  const handlePickUp = async () => {
    await pickUpCase.mutateAsync(crmCase.id);
  };

  const handleClose = async () => {
    await closeCase.mutateAsync({ caseId: crmCase.id, reason: closeReason });
    setCloseOpen(false);
  };

  const handleAddComm = async () => {
    if (!commSummary.trim()) { toast.error("Unesite rezime komunikacije"); return; }
    await addCommunication.mutateAsync({
      case_id: crmCase.id,
      comm_type: commType,
      contact_name: commContact || null,
      subject: commSummary,
      body: commNextSteps || null,
      comm_date: `${commDate}T12:00:00`,
    });
    setCommSummary("");
    setCommNextSteps("");
    setCommContact("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadDocument.mutateAsync({
      caseId: crmCase.id,
      file,
      description: docDescription || undefined,
    });
    setDocDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (doc: CrmDocument) => {
    const { data } = await supabase.storage.from("crm-documents").download(doc.file_path);
    if (!data) { toast.error("Greška pri preuzimanju"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getUserDisplay = (uid: string | null) => {
    if (!uid) return "-";
    const u = companyUsers.find((u) => u.id === uid);
    if (!u) return uid.slice(0, 8) + "...";
    const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ");
    return fullName || u.email || uid.slice(0, 8) + "...";
  };

  return (
    <MainLayout title={`Predmet ${crmCase.case_number}`}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/pisarnica/predmeti")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Nazad
          </Button>
          <span className="font-mono text-lg font-semibold">{crmCase.case_number}</span>
          <Badge variant="outline">{typeObj?.code || "?"}</Badge>
          <Badge variant={CRM_STATUS_VARIANTS[crmCase.status] || "secondary"}>
            {CRM_STATUS_MAP[crmCase.status] || crmCase.status}
          </Badge>
          {crmCase.closing_reason && (
            <span className="text-sm text-muted-foreground">({crmCase.closing_reason})</span>
          )}
          <div className="flex-1" />
          {!isClosed && (
            <>
              <Button size="sm" onClick={handleSave} disabled={updateCase.isPending}>
                <Save className="h-4 w-4 mr-1" /> Sačuvaj
              </Button>
              {(isOwner || !crmCase.assigned_to) && crmCase.status === "draft" && (
                <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Dodeli
                </Button>
              )}
              {isOwner && (crmCase.status === "assigned" || crmCase.status === "in_progress") && (
                <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Predodeli
                </Button>
              )}
              {isAssignee && crmCase.status === "assigned" && (
                <Button size="sm" variant="default" onClick={handlePickUp}>
                  <Play className="h-4 w-4 mr-1" /> Preuzmi
                </Button>
              )}
              {(isOwner || isAssignee) && crmCase.status !== "draft" && (
                <Button size="sm" variant="destructive" onClick={() => setCloseOpen(true)}>
                  <XCircle className="h-4 w-4 mr-1" /> Zaključi
                </Button>
              )}
            </>
          )}
        </div>

        <Separator />

        {/* Main form + tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Case details */}
          <div className="lg:col-span-1 erp-card p-4 space-y-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            <div className="space-y-2">
              <Label>Vrsta CRM-a</Label>
              <Select value={typeId} onValueChange={setTypeId} disabled={isClosed}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.code} - {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Predmet</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={isClosed} />
            </div>
            <div className="space-y-2">
              <Label>Opis</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={isClosed} />
            </div>
            <div className="space-y-2">
              <Label>Partner</Label>
              <SearchablePartnerSelect
                partners={partners}
                value={partnerId}
                onValueChange={setPartnerId}
                disabled={isClosed}
              />
            </div>
            <div className="space-y-2">
              <Label>Kontakt sa</Label>
              <div className="relative">
                <Input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Ime kontakt osobe..."
                  disabled={isClosed}
                  list="contact-persons-list"
                />
                {partnerId && partnerContacts.length > 0 && (
                  <datalist id="contact-persons-list">
                    {partnerContacts.map((c) => (
                      <option key={c.id} value={c.contact_name}>
                        {c.position ? `${c.contact_name} — ${c.position}` : c.contact_name}
                      </option>
                    ))}
                  </datalist>
                )}
              </div>
            </div>
            {partnerId && partnerContacts.length > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Kontakt osobe ({partnerContacts.length})
                </Label>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                  {partnerContacts.map((c) => (
                    <div key={c.id} className="rounded-md border px-2 py-1 text-xs bg-muted/30 flex items-center gap-2 flex-wrap">
                      <span className="font-medium whitespace-nowrap">{c.contact_name}{c.position ? ` — ${c.position}` : ""}</span>
                      {c.phone1 && (
                        <span className="flex items-center gap-1 text-muted-foreground whitespace-nowrap"><Phone className="h-3 w-3" />{c.phone1}</span>
                      )}
                      {c.phone2 && (
                        <span className="flex items-center gap-1 text-muted-foreground whitespace-nowrap"><Phone className="h-3 w-3" />{c.phone2}</span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1 text-muted-foreground whitespace-nowrap"><Mail className="h-3 w-3" />{c.email}</span>
                      )}
                      {c.note && <span className="text-muted-foreground italic">{c.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prioritet</Label>
                <Select value={priority} onValueChange={setPriority} disabled={isClosed}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRM_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rok</Label>
                <LocaleDateInput value={deadline} onChange={setDeadline} disabled={isClosed} />
              </div>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Vlasnik: {getUserDisplay(crmCase.owner_user_id)}</p>
              <p>Zadužen: {getUserDisplay(crmCase.assigned_to)}</p>
            </div>
          </div>

          {/* Right: Tabs */}
          <div className="lg:col-span-2 erp-card p-4">
            <Tabs defaultValue="communications">
              <TabsList>
                <TabsTrigger value="communications">
                  <MessageSquare className="h-4 w-4 mr-1" /> Komunikacije ({communications.length})
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FileText className="h-4 w-4 mr-1" /> Dokumenti ({documents.length})
                </TabsTrigger>
                <TabsTrigger value="workflow">
                  <Clock className="h-4 w-4 mr-1" /> Workflow ({workflow.length})
                </TabsTrigger>
              </TabsList>

              {/* Communications Tab */}
              <TabsContent value="communications" className="space-y-4">
                {!isClosed && (
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <p className="text-sm font-medium">Nova komunikacija</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Način</Label>
                        <Select value={commType} onValueChange={setCommType}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COMMUNICATION_TYPES.map((ct) => (
                              <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Kontakt osoba</Label>
                        <Input value={commContact} onChange={(e) => setCommContact(e.target.value)} className="h-8" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Datum</Label>
                        <LocaleDateInput value={commDate} onChange={setCommDate} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rezime komunikacije</Label>
                      <Textarea value={commSummary} onChange={(e) => setCommSummary(e.target.value)} rows={2} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Naredni koraci</Label>
                      <Textarea value={commNextSteps} onChange={(e) => setCommNextSteps(e.target.value)} rows={2} />
                    </div>
                    <Button size="sm" onClick={handleAddComm} disabled={addCommunication.isPending}>
                      <Plus className="h-4 w-4 mr-1" /> Dodaj komunikaciju
                    </Button>
                  </div>
                )}
                {communications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nema komunikacija</p>
                ) : (
                  <div className="space-y-3">
                     {communications.map((comm) => (
                      <div key={comm.id} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {COMMUNICATION_TYPES.find((ct) => ct.value === comm.comm_type)?.label || comm.comm_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comm.comm_date), "dd.MM.yyyy HH:mm")}
                            </span>
                            {comm.contact_name && (
                              <span className="text-xs">• {comm.contact_name}</span>
                            )}
                          </div>
                          {!isClosed && (
                            <Button variant="ghost" size="icon" className="h-6 w-6"
                              onClick={() => deleteCommunication.mutate(comm.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comm.subject}</p>
                        {comm.body && (
                          <p className="text-xs text-muted-foreground mt-1">
                            <strong>Naredni koraci:</strong> {comm.body}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-4">
                {!isClosed && (
                  <div className="flex items-end gap-3">
                    <div className="space-y-1 flex-1">
                      <Label className="text-xs">Opis dokumenta</Label>
                      <Input value={docDescription} onChange={(e) => setDocDescription(e.target.value)} placeholder="Opcioni opis..." />
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadDocument.isPending}>
                      <Upload className="h-4 w-4 mr-1" />
                      {uploadDocument.isPending ? "Otprema..." : "Otpremi fajl"}
                    </Button>
                  </div>
                )}
                {documents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nema dokumenata</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naziv fajla</TableHead>
                        <TableHead>Opis</TableHead>
                        <TableHead className="w-[120px]">Datum</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-mono text-sm">{doc.file_name}</TableCell>
                          <TableCell className="text-sm">{doc.description || ""}</TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(doc.uploaded_at), "dd.MM.yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(doc)}>
                                <Download className="h-3 w-3" />
                              </Button>
                              {!isClosed && (
                                <Button variant="ghost" size="icon" className="h-7 w-7"
                                  onClick={() => deleteDocument.mutate(doc)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Workflow Tab */}
              <TabsContent value="workflow">
                {workflow.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Nema zapisa</p>
                ) : (
                  <div className="space-y-2">
                    {workflow.map((w) => (
                      <div key={w.id} className="flex items-start gap-3 border-l-2 border-primary/30 pl-3 py-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">
                              {w.action_type === "created" && "Kreiran"}
                              {w.action_type === "assigned" && "Dodeljen"}
                              {w.action_type === "picked_up" && "Preuzet u obradu"}
                              {w.action_type === "status_change" && "Promena statusa"}
                              {w.action_type === "reassigned" && "Predodeljen"}
                            </span>
                            {w.to_status && (
                              <Badge variant="outline" className="text-[10px] py-0">
                                {CRM_STATUS_MAP[w.to_status] || w.to_status}
                              </Badge>
                            )}
                          </div>
                          
                          {w.note && <p className="text-xs mt-1">{w.note}</p>}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          <p>{format(new Date(w.performed_at), "dd.MM.yyyy HH:mm")}</p>
                          <p>{getUserDisplay(w.performed_by)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Assign Dialog */}
      <AlertDialog open={assignOpen} onOpenChange={setAssignOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dodeli predmet</AlertDialogTitle>
            <AlertDialogDescription>Izaberite operatera i opciono odeljenje/rok.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Operater</Label>
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger><SelectValue placeholder="Izaberite operatera" /></SelectTrigger>
                <SelectContent>
                  {companyUsers.map((u) => {
                    const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
                    return <SelectItem key={u.id} value={u.id}>{name || u.email}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rok (opciono)</Label>
              <LocaleDateInput value={assignDeadline} onChange={setAssignDeadline} />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssign} disabled={!assignUserId}>Dodeli</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close Dialog */}
      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zaključi predmet</AlertDialogTitle>
            <AlertDialogDescription>Unesite razlog zaključenja.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={closeReason} onValueChange={setCloseReason}>
              <SelectTrigger><SelectValue placeholder="Izaberite razlog" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ponuda prihvaćena">Ponuda prihvaćena</SelectItem>
                <SelectItem value="Ponuda odbijena">Ponuda odbijena</SelectItem>
                <SelectItem value="Rešeno">Rešeno</SelectItem>
                <SelectItem value="Odustajanje">Odustajanje</SelectItem>
                <SelectItem value="Ostalo">Ostalo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleClose} disabled={!closeReason}>Zaključi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
