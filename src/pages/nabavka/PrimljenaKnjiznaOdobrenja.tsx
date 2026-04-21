import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, MoreHorizontal, Trash2, Eye, FileText, BookCheck, Undo2, FileSpreadsheet, Printer } from "lucide-react";
import { useReceivedCreditNotes, ReceivedCreditNote } from "@/hooks/useReceivedCreditNotes";
import { ReceivedCreditNoteHeaderDialog } from "@/components/nabavka/ReceivedCreditNoteHeaderDialog";
import { formatNumber, formatDate } from "@/lib/formatting";
import { exportReceivedCreditNotesToExcel, exportReceivedCreditNotesToPdf, printReceivedCreditNotes } from "@/lib/receivedCreditNoteListExportUtils";

const statusLabels: Record<string, string> = { draft: "Nacrt", posted: "Proknjiženo", cancelled: "Stornirano" };
const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = { draft: "secondary", posted: "default", cancelled: "destructive" };

export default function PrimljenaKnjiznaOdobrenja() {
  const { docs, isLoading, deleteDoc, postDoc, unpostDoc } = useReceivedCreditNotes();
  const navigate = useNavigate();
  const { user, selectedCompany } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<ReceivedCreditNote | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [docToPost, setDocToPost] = useState<ReceivedCreditNote | null>(null);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [docToUnpost, setDocToUnpost] = useState<ReceivedCreditNote | null>(null);
  const [userAccessLevel, setUserAccessLevel] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id || !selectedCompany?.id) return;
    const check = async () => {
      const { data } = await supabase.rpc("get_user_access_level", { _user_id: user.id, _company_id: selectedCompany.id, _module_code: "nabavka.ulazne_fakture", _org_unit_id: null });
      setUserAccessLevel(data);
    };
    check();
  }, [user?.id, selectedCompany?.id]);

  const canUnpost = userAccessLevel === "admin";

  const filtered = docs.filter((d) => {
    const q = searchTerm.toLowerCase();
    const matchSearch = d.internal_number.toLowerCase().includes(q) || d.supplier_document_number.toLowerCase().includes(q) || d.supplier_name?.toLowerCase().includes(q) || d.partner?.name.toLowerCase().includes(q);
    return matchSearch && (!dateFrom || d.document_date >= dateFrom) && (!dateTo || d.document_date <= dateTo);
  });

  const handleView = (d: ReceivedCreditNote) => navigate(`/nabavka/primljena-ko/${d.id}`);
  const handleNewSaved = (d: ReceivedCreditNote) => navigate(`/nabavka/primljena-ko/${d.id}`);

  return (
    <MainLayout title="Primljena knjižna odobrenja">
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Primljena knjižna odobrenja</h1>
            <p className="text-muted-foreground">Knjižna odobrenja primljena od dobavljača</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="grid grid-cols-3 sm:flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportReceivedCreditNotesToExcel(filtered, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })} className="w-full sm:w-auto"><FileSpreadsheet className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Excel</span></Button>
              <Button variant="outline" size="sm" onClick={() => exportReceivedCreditNotesToPdf(filtered, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })} className="w-full sm:w-auto"><FileText className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">PDF</span></Button>
              <Button variant="outline" size="sm" onClick={() => printReceivedCreditNotes(filtered, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })} className="w-full sm:w-auto"><Printer className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Štampa</span></Button>
            </div>
            <Button onClick={() => setHeaderDialogOpen(true)} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Novo PKO</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-end gap-3 lg:gap-4">
          <div className="relative sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px] lg:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input placeholder="Pretraži po broju ili dobavljaču..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" autoComplete="off" />
          </div>
          <div className="space-y-1"><Label className="text-xs">Datum od</Label><LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-full lg:w-[170px]" /></div>
          <div className="space-y-1"><Label className="text-xs">Datum do</Label><LocaleDateInput value={dateTo} onChange={setDateTo} className="w-full lg:w-[170px]" /></div>
        </div>

        <TableScrollContainer className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Interni broj</TableHead>
                <TableHead>Broj dokumenta</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Dobavljač</TableHead>
                <TableHead>PIB</TableHead>
                <TableHead>PDV</TableHead>
                <TableHead className="text-right">Ukupno</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{searchTerm ? "Nema rezultata" : "Nema primljenih knjižnih odobrenja."}</TableCell></TableRow>
              ) : filtered.map((d) => (
                <TableRow key={d.id} className="relative cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <a href={`/nabavka/primljena-ko/${d.id}`} onClick={(e) => { e.preventDefault(); handleView(d); }} className="absolute inset-0 z-0" aria-hidden="true" />
                    <span className="relative z-[1] flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /><span className="font-medium">{d.internal_number}</span></span>
                  </TableCell>
                  <TableCell>{d.supplier_document_number}</TableCell>
                  <TableCell>{formatDate(d.document_date)}</TableCell>
                  <TableCell><div><div className="font-medium">{d.supplier_name || d.partner?.name}</div><div className="text-xs text-muted-foreground">{d.partner?.code}</div></div></TableCell>
                  <TableCell className="text-xs">{d.supplier_pib}</TableCell>
                  <TableCell><Badge variant={d.supplier_is_in_pdv ? "default" : "outline"}>{d.supplier_is_in_pdv ? "Da" : "Ne"}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatNumber(d.total_amount)}</TableCell>
                  <TableCell><Badge variant={statusVariants[d.status]}>{statusLabels[d.status]}</Badge></TableCell>
                  <TableCell className="relative z-10" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild><a href={`/nabavka/primljena-ko/${d.id}`} onClick={(e) => { e.preventDefault(); handleView(d); }}><Eye className="h-4 w-4 mr-2" />Prikaži</a></DropdownMenuItem>
                        {d.status === "draft" && <DropdownMenuItem onClick={() => { setDocToPost(d); setPostDialogOpen(true); }}><BookCheck className="h-4 w-4 mr-2" />Proknjiži</DropdownMenuItem>}
                        {d.status === "posted" && canUnpost && <DropdownMenuItem onClick={() => { setDocToUnpost(d); setUnpostDialogOpen(true); }}><Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje</DropdownMenuItem>}
                        {d.status === "draft" && <DropdownMenuItem onClick={() => { setDocToDelete(d); setDeleteDialogOpen(true); }} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Obriši</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      <ReceivedCreditNoteHeaderDialog open={headerDialogOpen} onOpenChange={setHeaderDialogOpen} doc={null} onSaved={handleNewSaved} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Brisanje dokumenta</AlertDialogTitle><AlertDialogDescription>Da li ste sigurni da želite da obrišete {docToDelete?.internal_number}?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Otkaži</AlertDialogCancel><AlertDialogAction onClick={async () => { if (docToDelete) { await deleteDoc.mutateAsync(docToDelete.id); setDeleteDialogOpen(false); } }} className="bg-destructive text-destructive-foreground">Obriši</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Proknjiženje dokumenta</AlertDialogTitle><AlertDialogDescription>Da li ste sigurni da želite da proknjižite {docToPost?.internal_number}?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Otkaži</AlertDialogCancel><AlertDialogAction onClick={async () => { if (docToPost) { await postDoc.mutateAsync(docToPost.id); setPostDialogOpen(false); } }}>Proknjiži</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Poništavanje knjiženja</AlertDialogTitle><AlertDialogDescription>Da li ste sigurni da želite da poništite knjiženje {docToUnpost?.internal_number}?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Otkaži</AlertDialogCancel><AlertDialogAction onClick={async () => { if (docToUnpost) { await unpostDoc.mutateAsync(docToUnpost.id); setUnpostDialogOpen(false); } }} className="bg-destructive text-destructive-foreground">Poništi</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
