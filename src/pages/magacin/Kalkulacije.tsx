import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Trash2, Loader2 } from "lucide-react";
import {
  usePurchasePriceCalculations,
  PurchasePriceCalculation,
} from "@/hooks/usePurchasePriceCalculations";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatDecimal } from "@/lib/formatting";

const STATUS_OPTIONS = [
  { value: "all", label: "Svi statusi" },
  { value: "draft", label: "Nacrt" },
  { value: "posted", label: "Proknjiženo" },
];

export default function Kalkulacije() {
  const navigate = useNavigate();
  const { calculations, isLoading, deleteCalculation } = usePurchasePriceCalculations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState<PurchasePriceCalculation | null>(null);

  const filtered = useMemo(() => {
    return calculations.filter((c) => {
      const matchesSearch =
        c.calculation_number.toLowerCase().includes(search.toLowerCase()) ||
        c.goods_receipt?.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
        c.goods_receipt?.partner?.name?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || c.status === statusFilter;

      return matchesSearch && matchesStatus;
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
        </div>

        {/* Table */}
        <TableScrollContainer>
          <Table>
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
                <TableHead className="text-right">Akcije</TableHead>
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
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/magacin/kalkulacije/${calc.id}`)}
                  >
                    <TableCell className="font-medium">{calc.calculation_number}</TableCell>
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
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">Proknjiženo</Badge>
                      ) : (
                        <Badge variant="outline">Nacrt</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {calc.status === "draft" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(calc)}
                            title="Obriši"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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
    </MainLayout>
  );
}
