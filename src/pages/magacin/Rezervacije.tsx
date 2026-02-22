import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Loader2, Plus, Trash2, FileSpreadsheet, Warehouse } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useWarehouseReservations, useCreateReservation, useDeleteReservation, type WarehouseReservation } from "@/hooks/useWarehouseReservations";
import { SearchableArticleSelect } from "@/components/ui/searchable-article-select";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { useArticles } from "@/hooks/useArticles";
import { usePartners } from "@/hooks/usePartners";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { formatDecimal, formatDate } from "@/lib/formatting";
import { format } from "date-fns";
import { toast } from "sonner";
import { exportReservationsListToExcel } from "@/lib/reservationExportUtils";

const DOC_TYPE_OPTIONS = [
  { value: "delivery_note", label: "Otpremnica" },
  { value: "invoice", label: "Faktura" },
  { value: "quote", label: "Ponuda" },
  { value: "other", label: "Ostalo" },
];

const DOC_TYPE_LABELS: Record<string, string> = {
  delivery_note: "Otpremnica",
  invoice: "Faktura",
  quote: "Ponuda",
  other: "Ostalo",
};

export default function Rezervacije() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const companyId = selectedCompany?.id;
  const businessYearId = selectedYear?.id;

  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseReservation | null>(null);

  const { warehouses, isLoading: whLoading } = useWarehouses(companyId);
  const { articles } = useArticles(companyId);
  const { partners } = usePartners();
  const { data: reservations, isLoading } = useWarehouseReservations(companyId, warehouseId || undefined, businessYearId);
  const createMutation = useCreateReservation();
  const deleteMutation = useDeleteReservation();

  // New reservation form state
  const [formArticleId, setFormArticleId] = useState("");
  const [formArticleCode, setFormArticleCode] = useState("");
  const [formArticleName, setFormArticleName] = useState("");
  const [formUnit, setFormUnit] = useState("kom");
  const [formQuantity, setFormQuantity] = useState("");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formDocType, setFormDocType] = useState("delivery_note");
  const [formDocNumber, setFormDocNumber] = useState("");
  const [formPartnerId, setFormPartnerId] = useState("");
  const [formPartnerCode, setFormPartnerCode] = useState("");
  const [formPartnerName, setFormPartnerName] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formWarehouseId, setFormWarehouseId] = useState("");

  const filtered = useMemo(() => {
    if (!reservations) return [];
    if (!search) return reservations;
    const q = search.toLowerCase();
    return reservations.filter(
      (r) =>
        r.article_code.toLowerCase().includes(q) ||
        r.article_name.toLowerCase().includes(q) ||
        r.document_number.toLowerCase().includes(q) ||
        (r.partner_name || "").toLowerCase().includes(q)
    );
  }, [reservations, search]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("reservation_date", "desc");

  const sorted = useMemo(() => {
    return sortItems(filtered, (item: WarehouseReservation, col: string) => {
      switch (col) {
        case "reservation_date": return item.reservation_date;
        case "article_code": return item.article_code;
        case "article_name": return item.article_name;
        case "quantity": return Number(item.quantity);
        case "document_type": return item.document_type;
        case "document_number": return item.document_number;
        case "partner_name": return item.partner_name || "";
        case "created_by_name": return item.created_by_name;
        default: return "";
      }
    });
  }, [filtered, sortItems]);

  const resetForm = () => {
    setFormArticleId("");
    setFormArticleCode("");
    setFormArticleName("");
    setFormUnit("kom");
    setFormQuantity("");
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormDocType("delivery_note");
    setFormDocNumber("");
    setFormPartnerId("");
    setFormPartnerCode("");
    setFormPartnerName("");
    setFormNote("");
    setFormWarehouseId("");
  };

  const handleAdd = async () => {
    const whId = formWarehouseId || warehouseId;
    if (!companyId || !businessYearId || !whId || !formArticleId || !formDocNumber || !formQuantity) {
      toast.error("Popunite sva obavezna polja.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        company_id: companyId,
        business_year_id: businessYearId,
        warehouse_id: whId,
        article_id: formArticleId,
        article_code: formArticleCode,
        article_name: formArticleName,
        unit: formUnit,
        quantity: parseFloat(formQuantity),
        reservation_date: formDate,
        document_type: formDocType,
        document_id: null,
        document_number: formDocNumber,
        partner_id: formPartnerId || null,
        partner_code: formPartnerCode || null,
        partner_name: formPartnerName || null,
        note: formNote || null,
        created_by: user?.id || "",
        created_by_name: user?.email || "",
      });
      toast.success("Rezervacija je kreirana.");
      setShowAddDialog(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Greška pri kreiranju rezervacije.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Rezervacija je obrisana.");
    } catch (err: any) {
      toast.error(err.message || "Greška pri brisanju.");
    }
    setDeleteTarget(null);
  };

  return (
    <MainLayout title="Rezervacije artikala">
      <div className="flex flex-col h-full min-h-0 gap-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap items-end">
          <div className="space-y-1">
            <Label className="text-xs">Magacin</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Svi magacini" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.filter((w) => w.is_active).map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.code} — {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1 min-w-[200px] space-y-1">
            <Label className="text-xs">Pretraga</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Šifra, naziv, dokument, partner..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {sorted.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => exportReservationsListToExcel(sorted)}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Excel
              </Button>
            )}
            <Button size="sm" onClick={() => { resetForm(); setShowAddDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Nova rezervacija
            </Button>
          </div>
        </div>

        {/* Table */}
        {isLoading || whLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TableScrollContainer className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortableHeader label="Datum" column="reservation_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Vrsta dok." column="document_type" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Broj dok." column="document_number" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Šifra" column="article_code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Naziv artikla" column="article_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortableHeader label="Količina" column="quantity" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Partner" column="partner_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader label="Operater" column="created_by_name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {search ? "Nema rezultata za zadati filter." : "Nema aktivnih rezervacija."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{formatDate(row.reservation_date)}</TableCell>
                      <TableCell>{DOC_TYPE_LABELS[row.document_type] || row.document_type}</TableCell>
                      <TableCell className="font-medium">{row.document_number}</TableCell>
                      <TableCell className="font-medium">{row.article_code}</TableCell>
                      <TableCell>{row.article_name}</TableCell>
                      <TableCell className="text-right font-medium">{formatDecimal(Number(row.quantity))}</TableCell>
                      <TableCell>{row.partner_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.created_by_name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(row)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableScrollContainer>
        )}
      </div>

      {/* Add Reservation Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova rezervacija</DialogTitle>
            <DialogDescription>Unesite podatke za rezervaciju artikla u magacinu.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Magacin *</Label>
              <Select value={formWarehouseId || warehouseId} onValueChange={setFormWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Izaberite magacin..." />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter((w) => w.is_active).map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>{wh.code} — {wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Artikal *</Label>
              <SearchableArticleSelect
                articles={articles}
                value={formArticleId}
                onValueChange={(articleId, article) => {
                  setFormArticleId(articleId);
                  setFormArticleCode(article.code);
                  setFormArticleName(article.name);
                  setFormUnit(article.unit);
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Količina *</Label>
                <Input type="number" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Datum *</Label>
                <LocaleDateInput value={formDate} onChange={setFormDate} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Vrsta dokumenta *</Label>
                <Select value={formDocType} onValueChange={setFormDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Broj dokumenta *</Label>
                <Input value={formDocNumber} onChange={(e) => setFormDocNumber(e.target.value)} placeholder="Broj" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Partner</Label>
              <SearchablePartnerSelect
                partners={partners}
                value={formPartnerId}
                onValueChange={(partnerId) => {
                  const p = partners.find(pp => pp.id === partnerId);
                  if (p) {
                    setFormPartnerId(p.id);
                    setFormPartnerCode(p.code);
                    setFormPartnerName(p.name);
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Napomena</Label>
              <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Napomena..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Otkaži</Button>
            <Button onClick={handleAdd} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Sačuvaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje rezervacije</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete rezervaciju za artikal{" "}
              <strong>{deleteTarget?.article_code} — {deleteTarget?.article_name}</strong> (kol: {deleteTarget ? formatDecimal(Number(deleteTarget.quantity)) : ""})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
