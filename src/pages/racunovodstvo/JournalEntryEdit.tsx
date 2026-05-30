import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil, ArrowLeft, RefreshCw, Plus, Trash2, History } from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { JournalEntry, useJournalEntryItems, useJournalEntryMutations, useJournalEntryItemMutations, STATUS_LABELS, STATUS_COLORS, JournalEntryItem } from "@/hooks/useJournalEntries";
import { JournalEntryItemForm } from "@/components/racunovodstvo/JournalEntryItemForm";
import { formatDate } from "@/lib/formatting";
import { formatNumber } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentLock } from "@/hooks/useDocumentLock";
import { useBusinessYearDateLimits } from "@/hooks/useBusinessYearDateLimits";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BookCheck, Undo2 } from "lucide-react";

const SOURCE_DOCUMENT_LABELS: Record<string, string> = {
  goods_purchase_invoice: "Ulazna faktura za robu",
  service_purchase_invoice: "Ulazna faktura za usluge",
  purchase_price_calculation: "Kalkulacija nabavne cene",
  inventory_count: "Popis",
  inter_warehouse_transfer: "Međumagacinski prenos",
  material_requisition: "Trebovanje",
  production_delivery_note: "Predajnica gotovih proizvoda",
  invoice: "Izlazna faktura",
  delivery_note: "Otpremnica",
  advance_invoice: "Avansni račun",
  credit_note: "Knjižno odobrenje",
  received_credit_note: "Primljeno knjižno odobrenje",
  payroll_calculation: "Obračun zarada",
};

export default function JournalEntryEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedCompany, selectedYear, user } = useAuth();
  const { minDate, maxDate } = useBusinessYearDateLimits();

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<JournalEntryItem | null>(null);
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [headerForm, setHeaderForm] = useState({
    description: "",
    entry_date: "",
    document_date: "",
    document_number: "",
  });

  const { data: items = [], isLoading: itemsLoading } = useJournalEntryItems(id || null);
  const { updateEntry, postEntry, unpostEntry } = useJournalEntryMutations();
  const { addItem, updateItem, deleteItem } = useJournalEntryItemMutations();
  
  // Optimistic locking
  const { checkLock, updateLockTimestamp } = useDocumentLock({
    tableName: "journal_entries",
    documentId: id || null,
    initialUpdatedAt: entry?.updated_at || null,
    onConflict: () => fetchEntry(),
  });

  // Fetch entry data
  const fetchEntry = async () => {
    if (!id) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Greška pri učitavanju dokumenta");
      navigate("/racunovodstvo/nalozi");
      return;
    }

    setEntry(data as JournalEntry);
    updateLockTimestamp(data.updated_at);
    setHeaderForm({
      description: data.description || "",
      entry_date: data.entry_date || "",
      document_date: data.document_date || "",
      document_number: data.document_number || "",
    });
    setIsLoading(false);
  };

  useEffect(() => {
    fetchEntry();
  }, [id]);

  // Auto-open "Dodaj stavku" kada je nalog tek kreiran (?addItem=1)
  useEffect(() => {
    if (!entry) return;
    if (searchParams.get("addItem") === "1" && entry.status === "draft") {
      setAddItemDialogOpen(true);
      searchParams.delete("addItem");
      setSearchParams(searchParams, { replace: true });
    }
  }, [entry, searchParams, setSearchParams]);

  const handleSaveHeader = async () => {
    if (!entry) return;
    
    const canProceed = await checkLock();
    if (!canProceed) return;
    
    await updateEntry.mutateAsync({
      id: entry.id,
      ...headerForm,
    });
    setHeaderDialogOpen(false);
    fetchEntry();
  };

  const handlePostConfirm = async () => {
    if (!entry) return;
    
    const canProceed = await checkLock();
    if (!canProceed) return;
    
    await postEntry.mutateAsync(entry.id);
    setPostDialogOpen(false);
    fetchEntry();
  };

  const handleUnpostConfirm = async () => {
    if (!entry) return;
    
    await unpostEntry.mutateAsync(entry.id);
    setUnpostDialogOpen(false);
    fetchEntry();
  };

  const handleDeleteItem = async (item: JournalEntryItem) => {
    if (confirm("Da li ste sigurni da želite da obrišete ovu stavku?")) {
      await deleteItem.mutateAsync({ id: item.id, entryId: entry!.id });
    }
  };

  const totalDebit = items.reduce((sum, item) => sum + Number(item.debit_amount), 0);
  const totalCredit = items.reduce((sum, item) => sum + Number(item.credit_amount), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  if (isLoading || !selectedCompany || !selectedYear) {
    return (
      <MainLayout title="Učitavanje...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!entry) {
    return (
      <MainLayout title="Dokument nije pronađen">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Dokument nije pronađen ili nemate pristup.</p>
          <Button onClick={() => navigate("/racunovodstvo/nalozi")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Nazad na listu
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isDraft = entry.status === "draft";
  const isPosted = entry.status === "posted";
  const canUnpost = isPosted && !entry.source_document_type;

  return (
    <MainLayout title={`Nalog: ${entry.entry_number}`}>
      <div className="flex-1 min-h-0 overflow-auto space-y-4">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/racunovodstvo/nalozi")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nazad
            </Button>
            <h1 className="text-xl font-semibold">Nalog {entry.entry_number}</h1>
            <Badge className={cn("text-xs", STATUS_COLORS[entry.status])}>
              {STATUS_LABELS[entry.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchEntry} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isDraft && (
              <>
                <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
                </Button>
                <Button size="sm" onClick={() => setPostDialogOpen(true)} disabled={!isBalanced || items.length === 0}>
                  <BookCheck className="h-4 w-4 mr-2" />Proknjiži
                </Button>
              </>
            )}
            {canUnpost && (
              <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => setUnpostDialogOpen(true)}>
                <Undo2 className="h-4 w-4 mr-2" />Poništi knjiženje
              </Button>
            )}
          </div>
        </div>

        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
          <div>
            <div className="text-muted-foreground">Datum knjiženja</div>
            <div className="font-medium">{formatDate(entry.entry_date)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Datum dokumenta</div>
            <div className="font-medium">{entry.document_date ? formatDate(entry.document_date) : "-"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Broj dokumenta</div>
            <div className="font-medium">{entry.document_number || "-"}</div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="text-muted-foreground">Opis</div>
            <div className="font-medium">{entry.description}</div>
          </div>
        </div>

        {entry.source_document_type && (
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md">
            Ovaj nalog je kreiran iz dokumenta: {SOURCE_DOCUMENT_LABELS[entry.source_document_type] || entry.source_document_type}. 
            Knjiženje se može poništiti samo kroz originalni dokument.
          </div>
        )}

        <Separator />

        {/* Items table */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Stavke</h2>
          {isDraft && (
            <Button onClick={() => setAddItemDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Dodaj stavku
            </Button>
          )}
        </div>

        <div className="rounded-md border max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-[100px]">Konto</TableHead>
                <TableHead className="w-[140px]">Naziv konta</TableHead>
                <TableHead className="w-[100px]">Analitika</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="w-[140px]">Dokument</TableHead>
                <TableHead className="w-[100px]">Valuta</TableHead>
                <TableHead className="w-[160px] text-right">Duguje</TableHead>
                <TableHead className="w-[160px] text-right">Potražuje</TableHead>
                {isDraft && <TableHead className="w-[80px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsLoading ? (
                <TableRow>
                   <TableCell colSpan={isDraft ? 9 : 8} className="text-center py-8">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isDraft ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    Nema stavki. Dodajte prvu stavku.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow 
                    key={item.id}
                    className={cn(isDraft && "cursor-pointer hover:bg-muted/50")}
                    onClick={() => isDraft && setEditingItem(item)}
                  >
                    <TableCell className="font-mono">{item.account_code}</TableCell>
                    <TableCell className="text-sm">{item.account_name || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{item.cost_center_code || item.partner_code || "-"}</TableCell>
                    <TableCell>{item.description || "-"}</TableCell>
                    <TableCell className="text-xs">
                      <div className="leading-tight">
                        {item.item_document_number || entry.document_number || "-"}
                        {(item.item_document_date || entry.document_date) && (
                          <div className="text-muted-foreground text-[10px]">
                            {formatDate(item.item_document_date || entry.document_date)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{item.document_date ? formatDate(item.document_date) : "-"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(item.debit_amount) !== 0 
                        ? formatNumber(item.debit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(item.credit_amount) !== 0 
                        ? formatNumber(item.credit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : ""}
                    </TableCell>
                    {isDraft && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingItem(item); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={isDraft ? 6 : 6} className="text-right font-medium">
                  Ukupno:
                </TableCell>
                <TableCell className="text-right font-mono font-bold">
                  {formatNumber(totalDebit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right font-mono font-bold">
                  {formatNumber(totalCredit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                {isDraft && <TableCell></TableCell>}
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* Balance indicator */}
        <div className={cn(
          "px-3 py-1.5 rounded-md text-sm inline-block",
          isBalanced
            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        )}>
          {isBalanced ? "✓ Nalog je balansiran" : `✗ Razlika: ${formatNumber(Math.abs(totalDebit - totalCredit), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </div>

      </div>

      {/* Header edit dialog */}
      <Dialog open={headerDialogOpen} onOpenChange={setHeaderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Uredi zaglavlje</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Datum knjiženja *</Label>
              <LocaleDateInput
                value={headerForm.entry_date}
                onChange={(value) => setHeaderForm({ ...headerForm, entry_date: value })}
                minDate={minDate}
                maxDate={maxDate}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Datum dokumenta</Label>
                <LocaleDateInput
                  value={headerForm.document_date}
                  onChange={(value) => setHeaderForm({ ...headerForm, document_date: value })}
                  minDate={minDate}
                  maxDate={maxDate}
                />
              </div>
              <div className="space-y-2">
                <Label>Broj dokumenta</Label>
                <Input
                  value={headerForm.document_number}
                  onChange={(e) => setHeaderForm({ ...headerForm, document_number: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Opis *</Label>
              <Input
                value={headerForm.description}
                onChange={(e) => setHeaderForm({ ...headerForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHeaderDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSaveHeader} disabled={!headerForm.entry_date || !headerForm.description}>
              Sačuvaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit item dialog */}
      <JournalEntryItemForm
        entryId={entry.id}
        item={editingItem || undefined}
        open={addItemDialogOpen || !!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setAddItemDialogOpen(false);
            setEditingItem(null);
          }
        }}
        onSave={async (data) => {
          if (editingItem) {
            await updateItem.mutateAsync({ id: editingItem.id, ...data });
          } else {
            await addItem.mutateAsync({ journal_entry_id: entry.id, ...data });
          }
          setAddItemDialogOpen(false);
          setEditingItem(null);
        }}
      />

      {/* Post confirmation */}
      <AlertDialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjiženje naloga</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite nalog {entry.entry_number}?
              Proknjižen nalog se više ne može menjati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handlePostConfirm}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unpost confirmation */}
      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništavanje knjiženja</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje naloga {entry.entry_number}?
              Nalog će biti vraćen u status "Nacrt".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpostConfirm} className="bg-destructive text-destructive-foreground">
              Poništi knjiženje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {entry && (
        <DocumentHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={entry.id} documentName={entry.entry_number} documentType="journal_entry" />
      )}
    </MainLayout>
  );
}
