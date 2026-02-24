import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, FileText, MoreHorizontal, Trash2, Eye, Undo2, FileSpreadsheet, Printer } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { useAuth } from "@/contexts/AuthContext";
import { useDeliveryOrders, useDeleteDeliveryOrder, useRevertDeliveryOrderToDraft, DeliveryOrder } from "@/hooks/useDeliveryOrders";
import { exportDeliveryOrdersToExcel, exportDeliveryOrdersToPdf, printDeliveryOrders } from "@/lib/deliveryOrderListExportUtils";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Nacrt", variant: "secondary" },
  approved: { label: "Odobren", variant: "outline" },
  reserved: { label: "Rezervisan", variant: "default" },
  shipped: { label: "Otpremljen", variant: "destructive" },
};

export default function NaloziZaIsporuku() {
  const navigate = useNavigate();
  const { selectedCompany, selectedYear } = useAuth();
  const { data: orders, isLoading } = useDeliveryOrders(selectedCompany?.id, selectedYear?.id);
  const deleteMutation = useDeleteDeliveryOrder();
  const revertMutation = useRevertDeliveryOrderToDraft();

  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredOrders = (orders || []).filter((o) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      o.order_number.toLowerCase().includes(searchLower) ||
      o.partner?.name?.toLowerCase().includes(searchLower) ||
      o.partner?.code?.toLowerCase().includes(searchLower);
    const matchesDateFrom = !dateFrom || o.order_date >= dateFrom;
    const matchesDateTo = !dateTo || o.order_date <= dateTo;
    return matchesSearch && matchesDateFrom && matchesDateTo;
  });

  const handleNavigate = (order: DeliveryOrder) => {
    navigate(`/prodaja/nalozi-isporuka/${order.id}`);
  };

  const handleDelete = async (order: DeliveryOrder) => {
    if (window.confirm(`Da li ste sigurni da želite da obrišete nalog ${order.order_number}?`)) {
      await deleteMutation.mutateAsync(order.id);
    }
  };

  const handleCreate = () => {
    navigate("/prodaja/nalozi-isporuka/new");
  };

  return (
    <MainLayout title="Nalozi za isporuku">
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nalozi za isporuku</h1>
            <p className="text-muted-foreground">Upravljanje nalozima za isporuku</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportDeliveryOrdersToExcel(filteredOrders, { companyName: selectedCompany?.name || "", dateFrom, dateTo })}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportDeliveryOrdersToPdf(filteredOrders, { companyName: selectedCompany?.name || "", dateFrom, dateTo })}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printDeliveryOrders(filteredOrders, { companyName: selectedCompany?.name || "", dateFrom, dateTo })}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Novi nalog
            </Button>
          </div>
        </div>

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

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Broj naloga</TableHead>
                <TableHead className="w-[90px]">Datum</TableHead>
                <TableHead>Kupac</TableHead>
                <TableHead className="w-[300px]">Magacin</TableHead>
                <TableHead className="w-[80px]">Ponuda</TableHead>
                <TableHead className="w-[90px]">Otpremnica</TableHead>
                <TableHead className="w-[150px]">Kreirao</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? "Nema rezultata pretrage" : "Nema naloga za isporuku. Kreirajte novi nalog."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                  const status = STATUS_BADGES[order.status] || STATUS_BADGES.draft;
                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleNavigate(order)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{order.order_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.order_date), "dd.MM.yyyy")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{order.partner?.name}</div>
                          <div className="text-xs text-muted-foreground">{order.partner?.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.warehouse ? `${order.warehouse.code} - ${order.warehouse.name}` : "-"}
                      </TableCell>
                      <TableCell>
                        {order.source_quote?.quote_number || "-"}
                      </TableCell>
                      <TableCell>
                        {order.delivery_note?.delivery_number || "-"}
                      </TableCell>
                      <TableCell>{order.composed_by || "-"}</TableCell>
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
                            <DropdownMenuItem onClick={() => handleNavigate(order)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Prikaži
                            </DropdownMenuItem>
                            {order.status === "draft" && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(order)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Obriši
                              </DropdownMenuItem>
                            )}
                            {(order.status === "approved" || order.status === "reserved") && !order.delivery_note_id && (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (window.confirm(`Vratiti nalog ${order.order_number} u nacrt?`)) {
                                    revertMutation.mutate(order.id);
                                  }
                                }}
                              >
                                <Undo2 className="w-4 h-4 mr-2" />
                                Vrati u nacrt
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
      </div>
    </MainLayout>
  );
}
