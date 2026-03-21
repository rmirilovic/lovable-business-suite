import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Loader2, MoreHorizontal, Eye, BookCheck, Undo2, FileDown, Trash2 } from "lucide-react";
import {
  usePurchasePriceCalculations,
  PurchasePriceCalculation,
} from "@/hooks/usePurchasePriceCalculations";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatDecimal } from "@/lib/formatting";
import { supabase } from "@/integrations/supabase/client";
import { exportCalculationPdf } from "@/lib/calculationPdfGenerator";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "all", label: "Svi statusi" },
  { value: "draft", label: "Nacrt" },
  { value: "posted", label: "Proknjiženo" },
];

export default function Kalkulacije() {
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("robno.kalkulacije", "write");
  const canPostCalc = hasAccess("robno.kalkulacije", "admin");

  const { calculations, isLoading, deleteCalculation, postCalculation, unpostCalculation } = usePurchasePriceCalculations();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<PurchasePriceCalculation | null>(null);
  const [postConfirm, setPostConfirm] = useState<PurchasePriceCalculation | null>(null);
  const [unpostConfirm, setUnpostConfirm] = useState<PurchasePriceCalculation | null>(null);

  const filtered = useMemo(() => {
    return calculations.filter((c) => {
      const matchesSearch =
        c.calculation_number.toLowerCase().includes(search.toLowerCase()) ||
        c.goods_receipt?.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
        c.goods_receipt?.partner?.name?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesDateFrom = !dateFrom || c.calculation_date >= dateFrom;
      const matchesDateTo = !dateTo || c.calculation_date <= dateTo;

      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [calculations, search, statusFilter]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("calculation_number", "desc");

  const sortedData = useMemo(() => {
    return sortItems(filtered, (item, column) => {
      switch (column) {
        case "calculation_number": return item.calculation_number;
        case "calculation_date": return item.calculation_date;
        case "receipt_number": return item.goods_receipt?.receipt_number || "";
        case "partner": return item.goods_receipt?.partner?.name || "";
        case "total_selling_value": return item.total_selling_value;
        default: return "";
      }
    });
  }, [filtered, sortItems]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteCalculation.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const handlePost = async () => {
    if (!postConfirm) return;
    await postCalculation.mutateAsync(postConfirm.id);
    setPostConfirm(null);
  };

  const handleUnpost = async () => {
    if (!unpostConfirm) return;
    await unpostCalculation.mutateAsync(unpostConfirm.id);
    setUnpostConfirm(null);
  };

  const handleDownloadPdf = async (calc: PurchasePriceCalculation) => {
    if (!selectedCompany?.id) return;
    try {
      const [{ data: items }, { data: costs }, { data: company }] = await Promise.all([
        supabase
          .from("calculation_items")
          .select("*")
          .eq("calculation_id", calc.id)
          .order("item_order"),
        supabase
          .from("calculation_additional_costs")
          .select("*")
          .eq("calculation_id", calc.id)
          .order("item_order"),
        supabase
          .from("companies")
          .select("name, address, city, postal_code, pib, mb")
          .eq("id", selectedCompany.id)
          .single(),
      ]);
      if (!items || !company) throw new Error("Greška pri učitavanju podataka");
      await exportCalculationPdf(calc, items as any, costs as any || [], company);
    } catch (err: any) {
      toast.error(err.message || "Greška pri generisanju PDF-a");
    }
  };

  if (isLoading) {
    return (
      <MainLayout title="Kalkulacije nabavne cene">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Kalkulacije nabavne cene">
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po broju, prijemnici ili partneru..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <TableScrollContainer>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader label="Broj" column="calculation_number" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Datum" column="calculation_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Prijemnica" column="receipt_number" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Dobavljač" column="partner" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>Magacin</TableHead>
                <TableHead className="text-right">
                  <SortableHeader label="Prod. vrednost" column="total_selling_value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {calculations.length === 0
                      ? "Nema kalkulacija. Kreirajte kalkulaciju iz prijemnice."
                      : "Nema rezultata za zadati filter."}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((calc) => (
                  <TableRow
                    key={calc.id}
                    className="relative cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      <a
                        href={`/magacin/kalkulacije/${calc.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/magacin/kalkulacije/${calc.id}`); }}
                        className="absolute inset-0 z-0"
                        aria-hidden="true"
                      />
                      <span className="relative z-[1]">
                        {calc.calculation_number}
                      </span>
                    </TableCell>
                    <TableCell>
                      {format(new Date(calc.calculation_date), "dd.MM.yyyy", { locale: sr })}
                    </TableCell>
                    <TableCell>{calc.goods_receipt?.receipt_number || "—"}</TableCell>
                    <TableCell>{calc.goods_receipt?.partner?.name || "—"}</TableCell>
                    <TableCell>
                      {calc.goods_receipt?.warehouse
                        ? `${calc.goods_receipt.warehouse.code} - ${calc.goods_receipt.warehouse.name}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatDecimal(calc.total_selling_value, 2)}
                    </TableCell>
                    <TableCell>
                      {calc.status === "posted" ? (
                        <Badge variant="default">Proknjiženo</Badge>
                      ) : (
                        <Badge variant="secondary">Nacrt</Badge>
                      )}
                    </TableCell>
                    <TableCell className="relative z-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a
                              href={`/magacin/kalkulacije/${calc.id}`}
                              onClick={(e) => { e.preventDefault(); navigate(`/magacin/kalkulacije/${calc.id}`); }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Prikaži
                            </a>
                          </DropdownMenuItem>
                          {calc.status === "draft" && canPostCalc && (
                            <DropdownMenuItem onClick={() => setPostConfirm(calc)}>
                              <BookCheck className="h-4 w-4 mr-2" />
                              Proknjiži
                            </DropdownMenuItem>
                          )}
                          {calc.status === "posted" && canPostCalc && (
                            <DropdownMenuItem onClick={() => setUnpostConfirm(calc)}>
                              <Undo2 className="h-4 w-4 mr-2" />
                              Poništi knjiženje
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDownloadPdf(calc)}>
                            <FileDown className="h-4 w-4 mr-2" />
                            PDF
                          </DropdownMenuItem>
                          {calc.status === "draft" && canEdit && (
                            <DropdownMenuItem
                              onClick={() => setDeleteConfirm(calc)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Obriši
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati kalkulaciju?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete kalkulaciju{" "}
              <strong>{deleteConfirm?.calculation_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Post Confirmation */}
      <AlertDialog open={!!postConfirm} onOpenChange={() => setPostConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proknjižiti kalkulaciju?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da proknjižite kalkulaciju{" "}
              <strong>{postConfirm?.calculation_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost}>Proknjiži</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unpost Confirmation */}
      <AlertDialog open={!!unpostConfirm} onOpenChange={() => setUnpostConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništiti knjiženje?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje kalkulacije{" "}
              <strong>{unpostConfirm?.calculation_number}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnpost}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Poništi knjiženje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
