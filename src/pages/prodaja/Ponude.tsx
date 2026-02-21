import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, FileText, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuotes, Quote, QuoteFormData } from "@/hooks/useQuotes";
import { QuoteDialog } from "@/components/prodaja/QuoteDialog";
import { formatDecimal } from "@/lib/formatting";
import { format } from "date-fns";
import { LocaleDateInput } from "@/components/ui/locale-date-input";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  approved: { label: "Odobrena", variant: "outline" },
  posted: { label: "Potvrđena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
};

export default function Ponude() {
  const navigate = useNavigate();
  const { quotes, isLoading, createQuote, deleteQuote } = useQuotes();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredQuotes = quotes.filter((quote) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      quote.quote_number.toLowerCase().includes(searchLower) ||
      quote.partner?.name?.toLowerCase().includes(searchLower) ||
      quote.partner?.code?.toLowerCase().includes(searchLower);
    const matchesDateFrom = !dateFrom || quote.quote_date >= dateFrom;
    const matchesDateTo = !dateTo || quote.quote_date <= dateTo;
    return matchesSearch && matchesDateFrom && matchesDateTo;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Ponude</h1>
            <p className="text-muted-foreground">Upravljanje ponudama za kupce</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nova ponuda
          </Button>
        </div>

        {/* Search & Date Filters */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
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
            <LocaleDateInput value={dateFrom} onChange={setDateFrom} className="w-[170px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum do</Label>
            <LocaleDateInput value={dateTo} onChange={setDateTo} className="w-[170px]" />
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Broj ponude</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Kupac</TableHead>
                <TableHead>Važi do</TableHead>
                <TableHead className="text-right">Iznos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filteredQuotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Nema rezultata pretrage" : "Nema ponuda. Kreirajte novu ponudu."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotes.map((quote) => {
                  const status = STATUS_BADGES[quote.status] || STATUS_BADGES.draft;
                  return (
                    <TableRow
                      key={quote.id}
                      className="cursor-pointer hover:bg-muted/50 relative"
                      onClick={() => handleNavigate(quote)}
                    >
                      {/* Hidden link for right-click open in new tab */}
                      <a
                        href={`/prodaja/ponude/${quote.id}`}
                        onClick={(e) => handleNavigate(quote, e)}
                        className="absolute inset-0 z-0"
                        aria-label={`Otvori ponudu ${quote.quote_number}`}
                      />
                      <TableCell className="relative z-[1] pointer-events-none">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{quote.quote_number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="relative z-[1] pointer-events-none">
                        {format(new Date(quote.quote_date), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell className="relative z-[1] pointer-events-none">
                        <div>
                          <div className="font-medium">{quote.partner_name ?? quote.partner?.name}</div>
                          <div className="text-xs text-muted-foreground">{quote.partner?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell className="relative z-[1] pointer-events-none">
                        {quote.valid_until ? format(new Date(quote.valid_until), "dd.MM.yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium relative z-[1] pointer-events-none">
                        {formatDecimal(quote.total_amount)} RSD
                      </TableCell>
                      <TableCell className="relative z-[1] pointer-events-none">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="relative z-[2] pointer-events-auto" onClick={(e) => e.stopPropagation()}>
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
