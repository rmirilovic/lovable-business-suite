import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SortableHeader } from "@/components/ui/sortable-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, BookCheck, Undo2, Download, FileText, Printer } from "lucide-react";
import {
  useJournalEntries,
  useJournalEntryMutations,
  JournalEntry,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/hooks/useJournalEntries";
import { useTableSort } from "@/hooks/useTableSort";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { generateJournalEntriesListPdf } from "@/lib/journalEntriesListPdfGenerator";
import { printPdfBlob } from "@/lib/printPdf";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function NaloziZaKnjizenje() {
  const { data: entries = [], isLoading } = useJournalEntries();
  const { createEntry, deleteEntry, postEntry, unpostEntry } = useJournalEntryMutations();
  const { selectedCompany } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("entry_number", "desc");

  const [newEntryForm, setNewEntryForm] = useState({
    description: "",
    entry_date: format(new Date(), "yyyy-MM-dd"),
    document_date: "",
    document_number: "",
  });

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.description.toLowerCase().includes(search.toLowerCase()) ||
      entry.entry_number.includes(search) ||
      (entry.document_number?.toLowerCase().includes(search.toLowerCase()) ?? false);

    const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
    const matchesDateFrom = !dateFrom || entry.entry_date >= dateFrom;
    const matchesDateTo = !dateTo || entry.entry_date <= dateTo;

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const sortedEntries = sortItems(filteredEntries, (item: JournalEntry, column: string) => {
    switch (column) {
      case "entry_number": return item.entry_number;
      case "entry_date": return item.entry_date;
      case "description": return item.description;
      case "document_number": return item.document_number || "";
      case "total_debit": return item.total_debit;
      case "total_credit": return item.total_credit;
      case "status": return STATUS_LABELS[item.status] || item.status;
      default: return null;
    }
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
    const message = entry.source_document_type 
      ? `Da li ste sigurni da želite da proknjižite nalog ${entry.entry_number}?\n\nNAPOMENA: Ovaj nalog je kreiran iz drugog dokumenta i knjiženje se može poništiti samo kroz originalni dokument.`
      : `Da li ste sigurni da želite da proknjižite nalog ${entry.entry_number}?`;
    
    if (confirm(message)) {
      await postEntry.mutateAsync(entry.id);
    }
  };

  const handleUnpostEntry = async (entry: JournalEntry) => {
    if (confirm(`Da li ste sigurni da želite da poništite knjiženje naloga ${entry.entry_number}? Nalog će biti vraćen u status Nacrt.`)) {
      await unpostEntry.mutateAsync(entry.id);
    }
  };

  const handleViewEntry = (entry: JournalEntry) => {
    navigate(`/racunovodstvo/nalozi/${entry.id}`);
  };

  const handleExportExcel = () => {
    const data = sortedEntries.map((e) => ({
      "Broj": e.entry_number,
      "Datum": format(new Date(e.entry_date), "dd.MM.yyyy"),
      "Opis": e.description,
      "Dokument": e.document_number || "",
      "Duguje": e.total_debit,
      "Potražuje": e.total_credit,
      "Status": STATUS_LABELS[e.status] || e.status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nalozi");

    ws["!cols"] = [
      { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 12 },
    ];

    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `nalozi_za_knjizenje_${date}.xlsx`);
    toast.success(`Izvezeno ${sortedEntries.length} naloga`);
  };

  const handlePdf = async () => {
    const doc = await generateJournalEntriesListPdf(sortedEntries, selectedCompany?.name);
    doc.save(`nalozi_za_knjizenje_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const handlePrint = async () => {
    const doc = await generateJournalEntriesListPdf(sortedEntries, selectedCompany?.name);
    const blob = doc.output("blob");
    printPdfBlob(blob);
  };

  return (
    <MainLayout title="Nalozi za knjiženje">
      <div className="flex flex-col h-full min-h-0 gap-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between flex-shrink-0">
          <div className="flex gap-4 flex-1 flex-wrap">
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
            <div className="space-y-1">
              <Label className="text-xs">Datum od</Label>
              <LocaleDateInput
                value={dateFrom}
                onChange={setDateFrom}
                className="w-[170px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Datum do</Label>
              <LocaleDateInput
                value={dateTo}
                onChange={setDateTo}
                className="w-[170px]"
              />
            </div>
          </div>
          <div className="flex gap-2 items-start">
            <Button variant="outline" size="sm" onClick={handleExportExcel} title="Izvezi u Excel">
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePdf} title="Izvezi u PDF">
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} title="Štampaj">
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            <Button onClick={() => setNewDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novi nalog
            </Button>
          </div>
        </div>

        {/* Table */}
        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">
                  <SortableHeader column="entry_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="entry_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="description" label="Opis" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[120px]">
                  <SortableHeader column="document_number" label="Dokument" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[120px] text-right">
                  <SortableHeader column="total_debit" label="Duguje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                </TableHead>
                <TableHead className="w-[120px] text-right">
                  <SortableHeader column="total_credit" label="Potražuje" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
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
              ) : sortedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nema naloga za prikaz.
                  </TableCell>
                </TableRow>
              ) : (
                sortedEntries.map((entry) => (
                  <TableRow key={entry.id} className="relative cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <a
                        href={`/racunovodstvo/nalozi/${entry.id}`}
                        onClick={(e) => { e.preventDefault(); handleViewEntry(entry); }}
                        className="absolute inset-0 z-0"
                        tabIndex={-1}
                      />
                      {entry.entry_number}
                    </TableCell>
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
                    <TableCell className="relative z-10">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Pregled" asChild>
                          <a href={`/racunovodstvo/nalozi/${entry.id}`} onClick={(e) => { e.preventDefault(); handleViewEntry(entry); }}>
                            <Eye className="w-4 h-4" />
                          </a>
                        </Button>
                        {entry.status === "draft" && (
                          <>
                            <Button variant="ghost" size="icon" title="Izmeni" asChild>
                              <a href={`/racunovodstvo/nalozi/${entry.id}`} onClick={(e) => { e.preventDefault(); handleViewEntry(entry); }}>
                                <Pencil className="w-4 h-4" />
                              </a>
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
        </TableScrollContainer>
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

    </MainLayout>
  );
}
