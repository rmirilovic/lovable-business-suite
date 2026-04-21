import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, FileText, MoreHorizontal, Pencil, Trash2, Eye, FileSpreadsheet, Printer } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuotes, Quote, QuoteFormData } from "@/hooks/useQuotes";
import { QuoteDialog } from "@/components/prodaja/QuoteDialog";
import { formatDecimal, formatNumber } from "@/lib/formatting";
import { format } from "date-fns";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useAuth } from "@/contexts/AuthContext";
import { exportQuotesToExcel, exportQuotesToPdf, printQuotes } from "@/lib/quoteListExportUtils";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  approved: { label: "Odobrena", variant: "default" },
  posted: { label: "Potvrđena", variant: "outline" },
  cancelled: { label: "Stornirana", variant: "destructive" },
  renewed: { label: "Obnovljena", variant: "outline" },
};

export default function Ponude() {
  const navigate = useNavigate();
  const { quotes, isLoading, createQuote, deleteQuote } = useQuotes();
  const { selectedCompany } = useAuth();
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [composedByFilter, setComposedByFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredQuotes = quotes.filter((quote) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      quote.quote_number.toLowerCase().includes(searchLower) ||
      quote.partner?.name?.toLowerCase().includes(searchLower) ||
      quote.partner?.code?.toLowerCase().includes(searchLower);
    const matchesDateFrom = !dateFrom || quote.quote_date >= dateFrom;
    const matchesDateTo = !dateTo || quote.quote_date <= dateTo;
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
    const matchesComposedBy = composedByFilter === "all" || (quote.composed_by ?? "") === composedByFilter;
    return matchesSearch && matchesDateFrom && matchesDateTo && matchesStatus && matchesComposedBy;
  });

  const STATUS_LABELS: Record<string, string> = {
    draft: "Nacrt", approved: "Odobrena", posted: "Potvrđena", cancelled: "Stornirana",
  };

  const sortedQuotes = sortItems(filteredQuotes, (quote: Quote, column: string) => {
    switch (column) {
      case "quote_number": return quote.quote_number;
      case "quote_date": return quote.quote_date;
      case "partner": return quote.partner_name ?? quote.partner?.name ?? "";
      case "valid_until": return quote.valid_until ?? "";
      case "total_amount": return quote.total_amount ?? 0;
      case "status": return STATUS_LABELS[quote.status] ?? quote.status;
      case "composed_by": return quote.composed_by ?? "";
      default: return null;
    }
  });

  const handleCreate = () => {
    setDialogOpen(true);
  };

  const handleNavigate = (quote: Quote, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    navigate(`/prodaja/ponude/${quote.id}`);
  };

  const handleDelete = async (quote: Quote) => {
    if (window.confirm(`Da li ste sigurni da želite da obrišete ponudu ${quote.quote_number}?`)) {
      await deleteQuote.mutateAsync(quote.id);
    }
  };

  const handleSave = async (data: QuoteFormData) => {
    const newQuote = await createQuote.mutateAsync(data);
    setDialogOpen(false);
    if (newQuote) {
      navigate(`/prodaja/ponude/${newQuote.id}`);
    }
  };

  return (
    <MainLayout title="Ponude">
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ponude</h1>
            <p className="text-muted-foreground">Upravljanje ponudama za kupce</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="grid grid-cols-3 sm:flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportQuotesToExcel(filteredQuotes, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })} className="w-full sm:w-auto">
                <FileSpreadsheet className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportQuotesToPdf(filteredQuotes, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })} className="w-full sm:w-auto">
                <FileText className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">PDF</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => printQuotes(filteredQuotes, { companyName: selectedCompany?.name ?? "", dateFrom, dateTo })} className="w-full sm:w-auto">
                <Printer className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Štampa</span>
              </Button>
            </div>
            <Button onClick={handleCreate} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nova ponuda
            </Button>
          </div>
        </div>

        {/* Search & Date Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-end gap-3 lg:gap-4">
          <div className="relative sm:col-span-2 lg:col-span-1 lg:flex-1 lg:min-w-[200px] lg:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Pretraži po broju ili kupcu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum od</Label>
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-full lg:w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-full lg:w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sastavio</Label>
            <Select value={composedByFilter} onValueChange={setComposedByFilter}>
              <SelectTrigger className="w-full lg:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi</SelectItem>
                {[...new Set(quotes.map(q => q.composed_by).filter(Boolean))].sort().map(name => (
                  <SelectItem key={name!} value={name!}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Svi</SelectItem>
                <SelectItem value="draft">Nacrt</SelectItem>
                <SelectItem value="approved">Odobrena</SelectItem>
                <SelectItem value="renewed">Obnovljena</SelectItem>
                <SelectItem value="posted">Potvrđena</SelectItem>
                <SelectItem value="cancelled">Stornirana</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <TableScrollContainer className="border rounded-lg">
          <Table>
            <TableHeader>
             <TableRow>
                <TableHead className="w-[130px]"><SortableHeader column="quote_number" label="Broj ponude" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="quote_date" label="Datum" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="min-w-[300px]"><SortableHeader column="partner" label="Kupac" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[90px]"><SortableHeader column="valid_until" label="Važi do" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="text-right w-[130px]"><SortableHeader column="total_amount" label="Iznos" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-end" /></TableHead>
                <TableHead className="w-[150px]"><SortableHeader column="composed_by" label="Sastavio" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-[80px]"><SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : sortedQuotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Nema rezultata pretrage" : "Nema ponuda. Kreirajte novu ponudu."}
                  </TableCell>
                </TableRow>
              ) : (
                sortedQuotes.map((quote) => {
                  const status = STATUS_BADGES[quote.status] || STATUS_BADGES.draft;
                  return (
                    <TableRow
                      key={quote.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleNavigate(quote)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{quote.quote_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(quote.quote_date), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{quote.partner_name ?? quote.partner?.name}</div>
                          <div className="text-xs text-muted-foreground">{quote.partner?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {quote.valid_until ? format(new Date(quote.valid_until), "dd.MM.yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatNumber(quote.total_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{quote.composed_by || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleNavigate(quote)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Prikaži
                            </DropdownMenuItem>
                            {quote.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(quote)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Obriši
                              </DropdownMenuItem>
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

        {/* Create dialog */}
        <QuoteDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          quote={null}
          onSave={handleSave}
          isLoading={createQuote.isPending}
        />
      </div>
    </MainLayout>
  );
}
