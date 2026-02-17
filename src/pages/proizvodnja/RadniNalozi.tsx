import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { Textarea } from "@/components/ui/textarea";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { Plus, Search, Trash2, Rocket, Lock } from "lucide-react";
import { useWorkOrders, STATUS_LABELS, STATUS_COLORS, WorkOrder } from "@/hooks/useWorkOrders";
import { useWarehouses } from "@/hooks/useWarehouses";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export default function RadniNalozi() {
  const navigate = useNavigate();
  const { selectedCompany, user } = useAuth();
  const companyId = selectedCompany?.id;
  const { orders, isLoading, createOrder, deleteOrder, launchOrder, closeOrder } = useWorkOrders();
  const { warehouses } = useWarehouses(companyId);
  const gpWarehouses = warehouses.filter((w) => w.warehouse_type === "9" && w.is_active);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newForm, setNewForm] = useState({
    order_date: format(new Date(), "yyyy-MM-dd"),
    deadline_date: "",
    warehouse_id: "",
    issued_by: "",
  });

  const filteredOrders = orders.filter((o) => {
    const matchSearch =
      o.order_number.includes(search) ||
      o.issued_by.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = async () => {
    if (!newForm.warehouse_id || !newForm.order_date) return;
    const result = await createOrder.mutateAsync({
      order_date: newForm.order_date,
      deadline_date: newForm.deadline_date || undefined,
      warehouse_id: newForm.warehouse_id,
      issued_by: newForm.issued_by,
    });
    setShowNewDialog(false);
    navigate(`/proizvodnja/nalozi/${result.id}`);
  };

  const handleDelete = async (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    if (confirm(`Obrisati radni nalog ${order.order_number}?`)) {
      await deleteOrder.mutateAsync(order.id);
    }
  };

  const handleLaunch = async (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    if (confirm(`Lansirati radni nalog ${order.order_number}?`)) {
      await launchOrder.mutateAsync(order.id);
    }
  };

  const handleClose = async (e: React.MouseEvent, order: WorkOrder) => {
    e.stopPropagation();
    if (confirm(`Zaključiti radni nalog ${order.order_number}?`)) {
      await closeOrder.mutateAsync(order.id);
    }
  };

  return (
    <MainLayout title="Radni nalozi">
      <div className="flex flex-col h-[calc(100vh-theme(spacing.20))]">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between mb-4">
          <div className="flex gap-4 flex-1 items-end">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pretraži po broju ili izdavaocu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-1">
              {["all", "draft", "launched", "closed"].map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "Svi" : STATUS_LABELS[s]}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novi radni nalog
          </Button>
        </div>

        {/* Table */}
        <TableScrollContainer className="flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Broj</TableHead>
                <TableHead className="w-[100px]">Datum</TableHead>
                <TableHead className="w-[100px]">Rok</TableHead>
                <TableHead>Magacin GP</TableHead>
                <TableHead>Nalog izdao</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[120px]">Akcije</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Učitavanje...</TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nema radnih naloga.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/proizvodnja/nalozi/${order.id}`)}
                  >
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{format(new Date(order.order_date), "dd.MM.yyyy")}</TableCell>
                    <TableCell>
                      {order.deadline_date ? format(new Date(order.deadline_date), "dd.MM.yyyy") : "-"}
                    </TableCell>
                    <TableCell>{order.warehouse?.name || "-"}</TableCell>
                    <TableCell>{order.issued_by || "-"}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", STATUS_COLORS[order.status])}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {order.status === "draft" && (
                          <>
                            <Button variant="ghost" size="icon" title="Lansiraj" onClick={(e) => handleLaunch(e, order)}>
                              <Rocket className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Obriši" onClick={(e) => handleDelete(e, order)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                        {order.status === "launched" && (
                          <Button variant="ghost" size="icon" title="Zaključi" onClick={(e) => handleClose(e, order)}>
                            <Lock className="w-4 h-4 text-green-600" />
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

      {/* New Work Order Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novi radni nalog</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Datum radnog naloga *</Label>
              <LocaleDateInput
                value={newForm.order_date}
                onChange={(v) => setNewForm({ ...newForm, order_date: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Rok završetka</Label>
              <LocaleDateInput
                value={newForm.deadline_date}
                onChange={(v) => setNewForm({ ...newForm, deadline_date: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>Magacin gotovih proizvoda *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newForm.warehouse_id}
                onChange={(e) => setNewForm({ ...newForm, warehouse_id: e.target.value })}
              >
                <option value="">-- Izaberite --</option>
                {gpWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Nalog izdao</Label>
              <Input
                value={newForm.issued_by}
                onChange={(e) => setNewForm({ ...newForm, issued_by: e.target.value })}
                placeholder="Ime i prezime"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Otkaži</Button>
            <Button
              onClick={handleCreate}
              disabled={!newForm.order_date || !newForm.warehouse_id || createOrder.isPending}
            >
              Kreiraj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
