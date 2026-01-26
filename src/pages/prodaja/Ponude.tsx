import { useEffect, useState } from "react";
import { Plus, Search, FileText, MoreHorizontal, Pencil, Trash2, Eye, ArrowRightLeft } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuotes, Quote, QuoteFormData } from "@/hooks/useQuotes";
import { QuoteDialog } from "@/components/prodaja/QuoteDialog";
import { QuoteDetailDialog } from "@/components/prodaja/QuoteDetailDialog";
import { formatDecimal } from "@/lib/formatting";
import { format } from "date-fns";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  approved: { label: "Odobrena", variant: "outline" },
  posted: { label: "Potvrđena", variant: "default" },
  cancelled: { label: "Stornirana", variant: "destructive" },
};

export default function Ponude() {
  const { quotes, isLoading, createQuote, updateQuote, deleteQuote } = useQuotes();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  // Keep the opened quote in sync with latest query data (e.g. after approve)
  // Only depend on quotes array, compare by serialized value to avoid loops
  useEffect(() => {
    if (!selectedQuote) return;
    const updated = quotes.find((q) => q.id === selectedQuote.id);
    if (!updated) return;
    // Only update if status or approver changed (avoid infinite loop from reference changes)
    if (
      updated.status !== selectedQuote.status ||
      updated.approved_by !== selectedQuote.approved_by ||
      updated.approved_at !== selectedQuote.approved_at
    ) {
      setSelectedQuote(updated);
    }
  }, [quotes, selectedQuote?.id, selectedQuote?.status, selectedQuote?.approved_by, selectedQuote?.approved_at]);

  const filteredQuotes = quotes.filter((quote) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      quote.quote_number.toLowerCase().includes(searchLower) ||
      quote.partner?.name?.toLowerCase().includes(searchLower) ||
      quote.partner?.code?.toLowerCase().includes(searchLower)
    );
  });

  const handleCreate = () => {
    setSelectedQuote(null);
    setDialogOpen(true);
  };

  const handleEdit = (quote: Quote) => {
    setSelectedQuote(quote);
    setDialogOpen(true);
  };

  const handleView = (quote: Quote) => {
    setSelectedQuote(quote);
    setDetailDialogOpen(true);
  };

  const handleDelete = async (quote: Quote) => {
    if (window.confirm(`Da li ste sigurni da želite da obrišete ponudu ${quote.quote_number}?`)) {
      await deleteQuote.mutateAsync(quote.id);
    }
  };

  const handleSave = async (data: QuoteFormData) => {
    if (selectedQuote) {
      await updateQuote.mutateAsync({ id: selectedQuote.id, ...data });
    } else {
      const newQuote = await createQuote.mutateAsync(data);
      // Open detail dialog for the new quote
      if (newQuote) {
        setDialogOpen(false);
        setSelectedQuote(newQuote);
        setDetailDialogOpen(true);
      }
    }
    setDialogOpen(false);
  };

  const handleConvertToInvoice = () => {
    // TODO: Implement conversion to invoice
    console.log("Convert to invoice:", selectedQuote?.id);
  };

  const handleConvertToDeliveryNote = () => {
    // TODO: Implement conversion to delivery note
    console.log("Convert to delivery note:", selectedQuote?.id);
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

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Pretraži po broju ili kupcu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
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
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleView(quote)}
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
                        {formatDecimal(quote.total_amount)} RSD
                      </TableCell>
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
                            <DropdownMenuItem onClick={() => handleView(quote)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Prikaži
                            </DropdownMenuItem>
                            {quote.status === "draft" && (
                              <>
                                <DropdownMenuItem onClick={() => handleEdit(quote)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Uredi
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(quote)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Obriši
                                </DropdownMenuItem>
                              </>
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

        {/* Dialogs */}
        <QuoteDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          quote={selectedQuote}
          onSave={handleSave}
          isLoading={createQuote.isPending || updateQuote.isPending}
        />

        <QuoteDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          quote={selectedQuote}
          onEdit={() => {
            setDetailDialogOpen(false);
            handleEdit(selectedQuote!);
          }}
          onConvertToInvoice={handleConvertToInvoice}
          onConvertToDeliveryNote={handleConvertToDeliveryNote}
        />
      </div>
    </MainLayout>
  );
}
