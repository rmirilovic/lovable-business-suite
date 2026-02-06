import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, BookCheck, Undo2 } from "lucide-react";
import {
  useJournalEntries,
  useJournalEntryMutations,
  JournalEntry,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/hooks/useJournalEntries";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";
import { JournalEntryDialog } from "@/components/racunovodstvo/JournalEntryDialog";
import { cn } from "@/lib/utils";

export default function NaloziZaKnjizenje() {
  const { data: entries = [], isLoading } = useJournalEntries();
  const { createEntry, deleteEntry, postEntry, unpostEntry } = useJournalEntryMutations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const [newEntryForm, setNewEntryForm] = useState({
    description: "",
    entry_date: format(new Date(), "yyyy-MM-dd"),
    document_date: "",
    document_number: "",
  });

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.description.toLowerCase().includes(search.toLowerCase()) ||
      entry.entry_number.toString().includes(search) ||
      (entry.document_number?.toLowerCase().includes(search.toLowerCase()) ?? false);

    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCreateEntry = async () => {
    await createEntry.mutateAsync(newEntryForm);
    setNewDialogOpen(false);
    setNewEntryForm({
      description: "",
      entry_date: format(new Date(), "yyyy-MM-dd"),
      document_date: "",
      document_number: "",
    });
  };

  const handleDeleteEntry = async (entry: JournalEntry) => {
    if (confirm(`Da li ste sigurni da želite da obrišete nalog ${entry.entry_number}?`)) {
      await deleteEntry.mutateAsync(entry.id);
    }
  };

  const handlePostEntry = async (entry: JournalEntry) => {
    if (confirm(`Da li ste sigurni da želite da proknjižite nalog ${entry.entry_number}?`)) {
      await postEntry.mutateAsync(entry.id);
    }
  };

  const handleUnpostEntry = async (entry: JournalEntry) => {
    if (confirm(`Da li ste sigurni da želite da poništite knjiženje naloga ${entry.entry_number}? Nalog će biti vraćen u status Nacrt.`)) {
      await unpostEntry.mutateAsync(entry.id);
    }
  };

  const handleViewEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setViewDialogOpen(true);
  };

  return (
    <MainLayout title="Nalozi za knjiženje">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pretraži po opisu ili broju..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-1">
              {["all", "draft", "posted"].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status === "all" ? "Svi" : STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={() => setNewDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novi nalog
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Broj</TableHead>
                <TableHead className="w-[100px]">Datum</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="w-[120px]">Dokument</TableHead>
                <TableHead className="w-[120px] text-right">Duguje</TableHead>
                <TableHead className="w-[120px] text-right">Potražuje</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[140px]">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nema naloga za prikaz.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.entry_number}</TableCell>
                    <TableCell>{format(new Date(entry.entry_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{entry.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.document_number || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(entry.total_debit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(entry.total_credit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", STATUS_COLORS[entry.status])}>
                        {STATUS_LABELS[entry.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewEntry(entry)}
                          title="Pregled"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {entry.status === "draft" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewEntry(entry)}
                              title="Izmeni"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePostEntry(entry)}
                              title="Proknjiži"
                              disabled={postEntry.isPending}
                            >
                              <BookCheck className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteEntry(entry)}
                              title="Obriši"
                              disabled={deleteEntry.isPending}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {entry.status === "posted" && !entry.source_document_type && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnpostEntry(entry)}
                            title="Poništi knjiženje"
                            disabled={unpostEntry.isPending}
                          >
                            <Undo2 className="w-4 h-4 text-orange-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* New Entry Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novi nalog za knjiženje</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="entry_date">Datum knjiženja *</Label>
              <Input
                id="entry_date"
                type="date"
                value={newEntryForm.entry_date}
                onChange={(e) => setNewEntryForm({ ...newEntryForm, entry_date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="document_date">Datum dokumenta</Label>
                <Input
                  id="document_date"
                  type="date"
                  value={newEntryForm.document_date}
                  onChange={(e) => setNewEntryForm({ ...newEntryForm, document_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document_number">Broj dokumenta</Label>
                <Input
                  id="document_number"
                  value={newEntryForm.document_number}
                  onChange={(e) => setNewEntryForm({ ...newEntryForm, document_number: e.target.value })}
                  placeholder="FA-001/25"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Opis *</Label>
              <Input
                id="description"
                value={newEntryForm.description}
                onChange={(e) => setNewEntryForm({ ...newEntryForm, description: e.target.value })}
                placeholder="Opis naloga za knjiženje"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              Otkaži
            </Button>
            <Button
              onClick={handleCreateEntry}
              disabled={!newEntryForm.entry_date || !newEntryForm.description || createEntry.isPending}
            >
              Kreiraj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Entry Dialog */}
      <JournalEntryDialog
        entry={selectedEntry}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
      />
    </MainLayout>
  );
}
