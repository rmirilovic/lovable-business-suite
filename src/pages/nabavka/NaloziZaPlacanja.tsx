import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { usePaymentOrders, usePaymentOrderMutations, PaymentOrder } from "@/hooks/usePaymentOrders";
import { PaymentOrderDialog } from "@/components/nabavka/PaymentOrderDialog";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice, formatDate } from "@/lib/formatting";
import { usePartners, PAYMENT_PRIORITY_LABELS } from "@/hooks/usePartners";
import {
  exportPaymentOrdersToExcel,
  exportPaymentOrdersToPdf,
  printPaymentOrders,
} from "@/lib/paymentOrderListExportUtils";
import {
  Plus,
  Search,
  MoreHorizontal,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  Trash2,
  Eye,
  Edit,
  CheckCircle,
  Send,
  CreditCard,
  Settings2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "all", label: "Svi statusi" },
  { value: "draft", label: "Nacrt" },
  { value: "approved", label: "Odobren" },
  { value: "sent", label: "Poslat" },
  { value: "paid", label: "Plaćen" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Nacrt",
  approved: "Odobren",
  sent: "Poslat",
  paid: "Plaćen",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  approved: "default",
  sent: "outline",
  paid: "default",
};

const ROLE_VIEWS = [
  { value: "all", label: "Svi nalozi" },
  { value: "approver", label: "Odobravanje" },
  { value: "sender", label: "Slanje u banku" },
  { value: "payer", label: "Potvrda plaćanja" },
  { value: "viewer", label: "Pregled" },
];

const ALL_COLUMNS = [
  { key: "source_document_number", label: "Int. dokument", defaultVisible: true },
  { key: "partner_name", label: "Partner", defaultVisible: true },
  { key: "booking_date", label: "Datum", defaultVisible: true },
  { key: "supplier_document_number", label: "Dok. dobavljača", defaultVisible: true },
  { key: "supplier_document_date", label: "Dat. dok.", defaultVisible: false },
  { key: "due_date", label: "Valuta", defaultVisible: true },
  { key: "document_amount", label: "Iznos dok.", defaultVisible: true },
  { key: "previously_paid", label: "Preth. isplaćeno", defaultVisible: false },
  { key: "approved_amount", label: "Plaća se", defaultVisible: true },
  { key: "partner_bank_account", label: "TR dobavljača", defaultVisible: false },
  { key: "payment_reference", label: "Poziv na broj", defaultVisible: false },
  { key: "nbs_payment_code", label: "Šifra NBS", defaultVisible: false },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "approved_date", label: "Odobren", defaultVisible: true },
  { key: "sent_date", label: "Poslat", defaultVisible: false },
  { key: "paid_date", label: "Plaćen", defaultVisible: false },
  { key: "note", label: "Napomena", defaultVisible: false },
];

const STORAGE_KEY = "payment_orders_visible_columns";

export default function NaloziZaPlacanja() {
  const { data: orders = [], isLoading, refetch } = usePaymentOrders();
  const { createMutation, updateMutation, deleteMutation, updateStatusMutation } = usePaymentOrderMutations();
  const { isSuperAdmin, isLocalAdmin, selectedCompany } = useAuth();
  const { partners } = usePartners();

  const partnerPriorityMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const p of partners) {
      map[p.id] = p.payment_priority;
    }
    return map;
  }, [partners]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleView, setRoleView] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);
  const [splitConfirm, setSplitConfirm] = useState<{ order: PaymentOrder; newAmount: number } | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const roleFilteredOrders = useMemo(() => {
    switch (roleView) {
      case "approver":
        return orders.filter((o) => o.status === "draft" || o.status === "approved");
      case "sender":
        return orders.filter((o) => o.status === "approved" || o.status === "sent");
      case "payer":
        return orders.filter(
          (o) =>
            o.status === "sent" ||
            (o.status === "paid" && o.paid_date && isRecentlyPaid(o.paid_date))
        );
      case "viewer":
        return orders;
      default:
        return orders;
    }
  }, [orders, roleView]);

  const filtered = useMemo(() => {
    return roleFilteredOrders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          o.partner_name?.toLowerCase().includes(s) ||
          o.partner_code?.toLowerCase().includes(s) ||
          o.source_document_number?.toLowerCase().includes(s) ||
          o.supplier_document_number?.toLowerCase().includes(s) ||
          o.payment_reference?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [roleFilteredOrders, statusFilter, search]);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("booking_date", "desc");

  const sortedData = sortItems(filtered, (item: PaymentOrder, col: string) => {
    return (item as any)[col];
  });

  const isAdmin = isSuperAdmin || isLocalAdmin;
  const canApprove = isAdmin || roleView === "approver" || roleView === "all";
  const canSend = isAdmin || roleView === "sender" || roleView === "all";
  const canPay = isAdmin || roleView === "payer" || roleView === "all";
  const canDelete = isAdmin || roleView === "approver" || roleView === "all";
  const isViewOnly = roleView === "viewer";

  const handleCreate = () => {
    setSelectedOrder(null);
    setReadOnly(false);
    setDialogOpen(true);
  };

  const handleEdit = (order: PaymentOrder) => {
    setSelectedOrder(order);
    setReadOnly(order.status === "paid" || isViewOnly);
    setDialogOpen(true);
  };

  const handleView = (order: PaymentOrder) => {
    setSelectedOrder(order);
    setReadOnly(true);
    setDialogOpen(true);
  };

  const handleSave = (data: Partial<PaymentOrder>) => {
    if (selectedOrder) {
      updateMutation.mutate({ id: selectedOrder.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleStatusChange = (order: PaymentOrder, newStatus: string) => {
    if (newStatus === "approved" && order.approved_amount > 0) {
      const remaining = order.document_amount - order.previously_paid - order.approved_amount;
      if (remaining > 0.01) {
        setSplitConfirm({ order, newAmount: remaining });
      }
      updateStatusMutation.mutate({ id: order.id, status: newStatus });
    } else if (newStatus === "sent") {
      if (!order.bank_account_id) {
        toast.error("Potrebno je izabrati tekući račun pre slanja naloga");
        handleEdit(order);
        return;
      }
      updateStatusMutation.mutate({ id: order.id, status: newStatus });
    } else if (newStatus === "paid") {
      updateStatusMutation.mutate({
        id: order.id,
        status: newStatus,
        extra: { paid_amount: order.approved_amount, paid_date: order.approved_date },
      });
    } else {
      updateStatusMutation.mutate({ id: order.id, status: newStatus });
    }
  };

  const handleSplitConfirm = () => {
    if (!splitConfirm) return;
    const { order, newAmount } = splitConfirm;
    createMutation.mutate({
      source_document_type: order.source_document_type,
      source_document_id: order.source_document_id,
      source_document_number: order.source_document_number,
      partner_id: order.partner_id,
      partner_name: order.partner_name,
      partner_code: order.partner_code,
      booking_date: order.booking_date,
      supplier_document_number: order.supplier_document_number,
      supplier_document_date: order.supplier_document_date,
      due_date: order.due_date,
      document_amount: order.document_amount,
      previously_paid: order.document_amount - newAmount,
      approved_amount: newAmount,
      partner_bank_account: order.partner_bank_account,
      payment_reference: order.payment_reference,
      nbs_payment_code: order.nbs_payment_code,
      note: order.note,
    });
    setSplitConfirm(null);
  };

  const getNextStatus = (current: string) => {
    const flow: Record<string, string> = { draft: "approved", approved: "sent", sent: "paid" };
    return flow[current];
  };

  const getNextStatusLabel = (current: string) => {
    const labels: Record<string, string> = { draft: "Odobri", approved: "Pošalji", sent: "Plaćeno" };
    return labels[current];
  };

  const getNextStatusIcon = (current: string) => {
    const icons: Record<string, any> = { draft: CheckCircle, approved: Send, sent: CreditCard };
    return icons[current] || CheckCircle;
  };

  const colCount = visibleColumns.length + 1;

  const renderSortHeader = (col: string, label: string) => (
    <SortableHeader column={col} label={label} sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
  );

  return (
    <MainLayout title="Nalozi za plaćanja">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Nalozi za plaćanja</h1>
            <p className="text-sm text-muted-foreground">Evidencija i planiranje plaćanja obaveza</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportPaymentOrdersToExcel(sortedData, { companyName: selectedCompany?.name ?? "" })}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportPaymentOrdersToPdf(sortedData, { companyName: selectedCompany?.name ?? "" })}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => printPaymentOrders(sortedData, { companyName: selectedCompany?.name ?? "" })}>
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            {!isViewOnly && (
              <Button size="sm" onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-1" />
                Novi nalog
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pretraži..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={roleView} onValueChange={setRoleView}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLE_VIEWS.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <DropdownMenu open={columnSettingsOpen} onOpenChange={setColumnSettingsOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Settings2 className="w-4 h-4 mr-1" />Kolone</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {ALL_COLUMNS.map((col) => (
                <DropdownMenuItem key={col.key} onSelect={(e) => e.preventDefault()}>
                  <label className="flex items-center gap-2 cursor-pointer w-full">
                    <Checkbox checked={visibleColumns.includes(col.key)} onCheckedChange={() => toggleColumn(col.key)} />
                    <span className="text-sm">{col.label}</span>
                  </label>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-sm text-muted-foreground ml-auto">{sortedData.length} naloga</span>
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.includes("source_document_number") && <TableHead style={{ width: 130 }}>{renderSortHeader("source_document_number", "Int. dokument")}</TableHead>}
                {visibleColumns.includes("partner_name") && <TableHead style={{ minWidth: 180 }}>{renderSortHeader("partner_name", "Partner")}</TableHead>}
                {visibleColumns.includes("booking_date") && <TableHead style={{ width: 90 }}>{renderSortHeader("booking_date", "Datum")}</TableHead>}
                {visibleColumns.includes("supplier_document_number") && <TableHead style={{ width: 130 }}>{renderSortHeader("supplier_document_number", "Dok. dobavljača")}</TableHead>}
                {visibleColumns.includes("supplier_document_date") && <TableHead style={{ width: 90 }}>{renderSortHeader("supplier_document_date", "Dat. dok.")}</TableHead>}
                {visibleColumns.includes("due_date") && <TableHead style={{ width: 90 }}>{renderSortHeader("due_date", "Valuta")}</TableHead>}
                {visibleColumns.includes("document_amount") && <TableHead style={{ width: 110 }} className="text-right">{renderSortHeader("document_amount", "Iznos dok.")}</TableHead>}
                {visibleColumns.includes("previously_paid") && <TableHead style={{ width: 110 }} className="text-right">{renderSortHeader("previously_paid", "Preth. isplaćeno")}</TableHead>}
                {visibleColumns.includes("approved_amount") && <TableHead style={{ width: 110 }} className="text-right">{renderSortHeader("approved_amount", "Plaća se")}</TableHead>}
                {visibleColumns.includes("partner_bank_account") && <TableHead>{renderSortHeader("partner_bank_account", "TR dobavljača")}</TableHead>}
                {visibleColumns.includes("payment_reference") && <TableHead>{renderSortHeader("payment_reference", "Poziv na broj")}</TableHead>}
                {visibleColumns.includes("nbs_payment_code") && <TableHead style={{ width: 80 }}>{renderSortHeader("nbs_payment_code", "NBS")}</TableHead>}
                {visibleColumns.includes("status") && <TableHead style={{ width: 90 }}>{renderSortHeader("status", "Status")}</TableHead>}
                {visibleColumns.includes("approved_date") && <TableHead style={{ width: 90 }}>{renderSortHeader("approved_date", "Odobren")}</TableHead>}
                {visibleColumns.includes("sent_date") && <TableHead style={{ width: 90 }}>{renderSortHeader("sent_date", "Poslat")}</TableHead>}
                {visibleColumns.includes("paid_date") && <TableHead style={{ width: 90 }}>{renderSortHeader("paid_date", "Plaćen")}</TableHead>}
                {visibleColumns.includes("note") && <TableHead>{renderSortHeader("note", "Napomena")}</TableHead>}
                <TableHead style={{ width: 50 }} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell></TableRow>
              ) : sortedData.length === 0 ? (
                <TableRow><TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">Nema naloga za plaćanje</TableCell></TableRow>
              ) : (
                sortedData.map((order) => {
                  const nextStatus = getNextStatus(order.status);
                  const NextIcon = getNextStatusIcon(order.status);
                  const canAdvance =
                    (order.status === "draft" && canApprove) ||
                    (order.status === "approved" && canSend) ||
                    (order.status === "sent" && canPay);

                  return (
                    <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onDoubleClick={() => handleEdit(order)}>
                      {visibleColumns.includes("source_document_number") && <TableCell className="font-medium">{order.source_document_number || "-"}</TableCell>}
                      {visibleColumns.includes("partner_name") && (
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{order.partner_name}</span>
                            {order.partner_code && <span className="text-xs text-muted-foreground">({order.partner_code})</span>}
                            {order.partner_id && partnerPriorityMap[order.partner_id] && (
                              <Badge variant="outline" className={
                                partnerPriorityMap[order.partner_id] === 1
                                  ? "text-red-600 border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800 dark:text-red-400 text-[10px] px-1.5 py-0"
                                  : partnerPriorityMap[order.partner_id] === 2
                                  ? "text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-400 text-[10px] px-1.5 py-0"
                                  : "text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-400 text-[10px] px-1.5 py-0"
                              }>
                                {PAYMENT_PRIORITY_LABELS[partnerPriorityMap[order.partner_id]!]}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.includes("booking_date") && <TableCell>{formatDate(order.booking_date)}</TableCell>}
                      {visibleColumns.includes("supplier_document_number") && <TableCell>{order.supplier_document_number || "-"}</TableCell>}
                      {visibleColumns.includes("supplier_document_date") && <TableCell>{order.supplier_document_date ? formatDate(order.supplier_document_date) : "-"}</TableCell>}
                      {visibleColumns.includes("due_date") && <TableCell>{order.due_date ? formatDate(order.due_date) : "-"}</TableCell>}
                      {visibleColumns.includes("document_amount") && <TableCell className="text-right font-mono">{formatPrice(order.document_amount)}</TableCell>}
                      {visibleColumns.includes("previously_paid") && <TableCell className="text-right font-mono">{formatPrice(order.previously_paid)}</TableCell>}
                      {visibleColumns.includes("approved_amount") && <TableCell className="text-right font-mono font-medium">{formatPrice(order.approved_amount)}</TableCell>}
                      {visibleColumns.includes("partner_bank_account") && <TableCell>{order.partner_bank_account || "-"}</TableCell>}
                      {visibleColumns.includes("payment_reference") && <TableCell>{order.payment_reference || "-"}</TableCell>}
                      {visibleColumns.includes("nbs_payment_code") && <TableCell>{order.nbs_payment_code || "-"}</TableCell>}
                      {visibleColumns.includes("status") && (
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[order.status] || "secondary"}>
                            {STATUS_LABELS[order.status] || order.status}
                          </Badge>
                        </TableCell>
                      )}
                      {visibleColumns.includes("approved_date") && <TableCell>{order.approved_date ? formatDate(order.approved_date) : "-"}</TableCell>}
                      {visibleColumns.includes("sent_date") && <TableCell>{order.sent_date ? formatDate(order.sent_date) : "-"}</TableCell>}
                      {visibleColumns.includes("paid_date") && <TableCell>{order.paid_date ? formatDate(order.paid_date) : "-"}</TableCell>}
                      {visibleColumns.includes("note") && <TableCell className="max-w-[150px] truncate">{order.note || "-"}</TableCell>}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleView(order)}>
                              <Eye className="w-4 h-4 mr-2" />Pregled
                            </DropdownMenuItem>
                            {!isViewOnly && order.status !== "paid" && (
                              <DropdownMenuItem onClick={() => handleEdit(order)}>
                                <Edit className="w-4 h-4 mr-2" />Izmeni
                              </DropdownMenuItem>
                            )}
                            {canAdvance && nextStatus && (
                              <DropdownMenuItem onClick={() => handleStatusChange(order, nextStatus)}>
                                <NextIcon className="w-4 h-4 mr-2" />{getNextStatusLabel(order.status)}
                              </DropdownMenuItem>
                            )}
                            {canDelete && (order.status === "draft" || order.status === "approved") && (
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(order.id)}>
                                <Trash2 className="w-4 h-4 mr-2" />Obriši
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
        </TableScrollContainer>
      </div>

      <PaymentOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} order={selectedOrder} onSave={handleSave} readOnly={readOnly} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje naloga</AlertDialogTitle>
            <AlertDialogDescription>Da li ste sigurni da želite da obrišete ovaj nalog za plaćanje?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}>Obriši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!splitConfirm} onOpenChange={() => setSplitConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delimično plaćanje</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {splitConfirm && (
                  <>
                    <p>Ukupan iznos po dokumentu: <strong>{formatPrice(splitConfirm.order.document_amount)}</strong></p>
                    <p>Prethodno na nalozima: <strong>{formatPrice(splitConfirm.order.previously_paid)}</strong></p>
                    <p>Odobreno na ovoj stavci: <strong>{formatPrice(splitConfirm.order.approved_amount)}</strong></p>
                    <p>Da li želite da se kreira novi nalog na iznos od <strong>{formatPrice(splitConfirm.newAmount)}</strong>?</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ne</AlertDialogCancel>
            <AlertDialogAction onClick={handleSplitConfirm}>Da, kreiraj</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

function isRecentlyPaid(paidDate: string): boolean {
  const paid = new Date(paidDate);
  const now = new Date();
  const diffDays = (now.getTime() - paid.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 1;
}
