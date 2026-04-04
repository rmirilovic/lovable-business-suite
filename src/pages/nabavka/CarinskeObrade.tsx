import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, MoreHorizontal, Trash2, Eye } from "lucide-react";
import { useCustomsClearances, type CustomsClearance } from "@/hooks/useCustomsClearances";
import { CustomsClearanceHeaderDialog } from "@/components/nabavka/CustomsClearanceHeaderDialog";
import { formatNumber, formatDate } from "@/lib/formatting";
import { Skeleton } from "@/components/ui/skeleton";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";

const statusLabels: Record<string, string> = {
  draft: "Nacrt",
  posted: "Proknjiženo",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  posted: "default",
};

function getSortValue(item: CustomsClearance, column: string): any {
  switch (column) {
    case "clearance_number": return item.clearance_number;
    case "clearance_date": return item.clearance_date;
    case "invoice_value_rsd": return item.invoice_value_rsd;
    case "customs_duty_amount": return item.customs_duty_amount;
    case "total_cost_value": return item.total_cost_value;
    default: return (item as any)[column];
  }
}

export default function CarinskeObrade() {
  const navigate = useNavigate();
  const { clearances, isLoading, deleteClearance } = useCustomsClearances();
  const [searchTerm, setSearchTerm] = useState("");
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearanceToDelete, setClearanceToDelete] = useState<CustomsClearance | null>(null);

  const filteredClearances = useMemo(() => {
    if (!searchTerm) return clearances;
    const term = searchTerm.toLowerCase();
    return clearances.filter((c) =>
      c.clearance_number.toLowerCase().includes(term) ||
      c.jci_number?.toLowerCase().includes(term) ||
      c.source_invoice?.supplier_name?.toLowerCase().includes(term) ||
      c.source_invoice?.internal_number?.toLowerCase().includes(term)
    );
  }, [clearances, searchTerm]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("clearance_number", "desc");
  const sortedData = sortItems(filteredClearances, getSortValue);

  const handleDelete = async () => {
    if (!clearanceToDelete) return;
    try {
      await deleteClearance(clearanceToDelete.id);
    } catch { /* handled in hook */ }
    setDeleteDialogOpen(false);
    setClearanceToDelete(null);
  };

  const handleCreated = (id: string) => {
    setHeaderDialogOpen(false);
    navigate(`/nabavka/carinski-obracun/${id}`);
  };

  return (
    <MainLayout title="Carinski obračuni">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Carinski obračuni</h1>
          <Button onClick={() => setHeaderDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novi obračun
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraga..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader label="Broj" column="clearance_number" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead><SortableHeader label="Datum" column="clearance_date" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead>Izvorna UFR</TableHead>
                <TableHead>Dobavljač</TableHead>
                <TableHead>JCI broj</TableHead>
                <TableHead>Izvorni mag.</TableHead>
                <TableHead>Odredišni mag.</TableHead>
                <TableHead className="text-right"><SortableHeader label="Fakt. vr. (RSD)" column="invoice_value_rsd" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="text-right"><SortableHeader label="Carina" column="customs_duty_amount" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead className="text-right"><SortableHeader label="Nabavna vr." column="total_cost_value" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 12 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    {searchTerm ? "Nema rezultata pretrage" : "Nema carinskih obračuna"}
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/nabavka/carinski-obracun/${c.id}`)}
                  >
                    <TableCell className="font-medium">{c.clearance_number}</TableCell>
                    <TableCell>{formatDate(c.clearance_date)}</TableCell>
                    <TableCell>{c.source_invoice?.internal_number || "-"}</TableCell>
                    <TableCell>{c.source_invoice?.supplier_name || "-"}</TableCell>
                    <TableCell>{c.jci_number || "-"}</TableCell>
                    <TableCell>{c.source_warehouse?.name || "-"}</TableCell>
                    <TableCell>{c.destination_warehouse?.name || "-"}</TableCell>
                    <TableCell className="text-right">{formatNumber(c.invoice_value_rsd)}</TableCell>
                    <TableCell className="text-right">{formatNumber(c.customs_duty_amount)}</TableCell>
                    <TableCell className="text-right">{formatNumber(c.total_cost_value)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[c.status] || "secondary"}>
                        {statusLabels[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/nabavka/carinski-obracun/${c.id}`)}>
                            <Eye className="h-4 w-4 mr-2" /> Otvori
                          </DropdownMenuItem>
                          {c.status === "draft" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => { setClearanceToDelete(c); setDeleteDialogOpen(true); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Obriši
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

      <CustomsClearanceHeaderDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        onCreated={handleCreated}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje carinskog obračuna</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete carinski obračun {clearanceToDelete?.clearance_number}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
