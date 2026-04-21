import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, MoreHorizontal, Eye, Trash2, FileText, FileSpreadsheet, Printer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAdvanceInvoices, AdvanceInvoice } from "@/hooks/useAdvanceInvoices";
import { formatNumber } from "@/lib/formatting";
import { format } from "date-fns";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useAuth } from "@/contexts/AuthContext";

import { exportAdvanceInvoicesToExcel, exportAdvanceInvoicesToPdf, printAdvanceInvoices } from "@/lib/advanceInvoiceListExportUtils";
import { AdvanceInvoiceHeaderDialog } from "@/components/prodaja/AdvanceInvoiceHeaderDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  posted: { label: "Proknjižen", variant: "default" },
  cancelled: { label: "Storniran", variant: "destructive" },
};

export default function AvansniRacuni() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
   const { advanceInvoices, isLoading, createAdvanceInvoice, deleteAdvanceInvoice } = useAdvanceInvoices();
   const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();

   const [searchQuery, setSearchQuery] = useState("");
   const [dateFrom, setDateFrom] = useState("");
   const [dateTo, setDateTo] = useState("");
   const [statusFilter, setStatusFilter] = useState<string>("all");
   const [dialogOpen, setDialogOpen] = useState(false);
   const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
   const [itemToDelete, setItemToDelete] = useState<AdvanceInvoice | null>(null);

   const filteredItems = advanceInvoices.filter((item) => {
     const query = searchQuery.toLowerCase();
     const matchesSearch =
       item.advance_number.toLowerCase().includes(query) ||
       item.partner?.name?.toLowerCase().includes(query) ||
       item.partner?.code?.toLowerCase().includes(query);
     const matchesDateFrom = !dateFrom || item.advance_date >= dateFrom;
     const matchesDateTo = !dateTo || item.advance_date <= dateTo;
     const matchesStatus = statusFilter === "all" || item.status === statusFilter;
     return matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus;
   });

   const sortedItems = sortItems(filteredItems, (item, column) => {
     switch (column) {
       case "number": return item.advance_number;
       case "date": return item.advance_date;
       case "due_date": return item.due_date || "";
       case "partner": return item.partner?.name || "";
       case "total_amount": return item.total_amount;
       case "status": return item.status;
       default: return "";
     }
   });

   const handleNavigate = (item: AdvanceInvoice) => {
     navigate(`/prodaja/avansni-racuni/${item.id}`, { state: { prefetched: item } });
   };

   const handleCreateSave = async (data: any) => {
     const result = await createAdvanceInvoice.mutateAsync(data);
     setDialogOpen(false);
     navigate(`/prodaja/avansni-racuni/${result.id}`);
   };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteAdvanceInvoice.mutateAsync(itemToDelete.id);
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  return (
    <MainLayout title="Fakture za avans">
      <div className="space-y-4">
        {/* Actions row */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => exportAdvanceInvoicesToExcel(sortedItems, { companyName: selectedCompany?.name || "", dateFrom, dateTo })}>
            <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportAdvanceInvoicesToPdf(sortedItems, { companyName: selectedCompany?.name || "", dateFrom, dateTo })}>
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => printAdvanceInvoices(sortedItems, { companyName: selectedCompany?.name || "", dateFrom, dateTo })}>
            <Printer className="w-4 h-4 mr-2" /> Štampa
          </Button>
          <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova faktura za avans</Button>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pretraži..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi</SelectItem>
                <SelectItem value="draft">Nacrt</SelectItem>
                <SelectItem value="posted">Proknjižen</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[130px]"><SortableHeader column="number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="due_date" label="Valuta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="min-w-[300px]"><SortableHeader column="partner" label="Kupac" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="text-right w-[130px]"><SortableHeader column="total_amount" label="Iznos" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[80px]"><SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell></TableRow>
              ) : sortedItems.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{searchQuery ? "Nema rezultata" : "Nema faktura za avans."}</TableCell></TableRow>
              ) : (
                sortedItems.map((item) => {
                  const status = STATUS_BADGES[item.status] || STATUS_BADGES.draft;
                  return (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleNavigate(item)}>
                      <TableCell><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-muted-foreground" /><span className="font-medium">{item.advance_number}</span></div></TableCell>
                      <TableCell>{format(new Date(item.advance_date), "dd.MM.yyyy")}</TableCell>
                      <TableCell>{item.due_date ? format(new Date(item.due_date), "dd.MM.yyyy") : "-"}</TableCell>
                      <TableCell><div><div className="font-medium">{item.partner_name ?? item.partner?.name}</div><div className="text-xs text-muted-foreground">{item.partner?.code}</div></div></TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(item.total_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleNavigate(item)}><Eye className="w-4 h-4 mr-2" />Prikaži</DropdownMenuItem>
                            {item.status === "draft" && (
                              <DropdownMenuItem onClick={() => { setItemToDelete(item); setDeleteConfirmOpen(true); }} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Obriši</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

         <AdvanceInvoiceHeaderDialog
           open={dialogOpen}
           onOpenChange={setDialogOpen}
           title="Nova faktura za avans"
           onSave={handleCreateSave}
           isLoading={createAdvanceInvoice.isPending}
         />

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Potvrda brisanja</AlertDialogTitle>
              <AlertDialogDescription>Da li ste sigurni da želite da obrišete fakturu za avans {itemToDelete?.advance_number}?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Otkaži</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Obriši</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
