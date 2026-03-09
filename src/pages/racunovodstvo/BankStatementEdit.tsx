import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Trash2, BookCheck, Undo2, Pencil, Check, X, RefreshCw, History, Eye, FileDown, FileSpreadsheet, Printer, Columns3, MoreHorizontal } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useBankStatement,
  useBankStatementItems,
  useBankStatementMutations,
  useBankStatementItemMutations,
  BankStatementItem,
} from "@/hooks/useBankStatements";
import { usePaymentCodes } from "@/hooks/usePaymentCodes";
import { usePartners } from "@/hooks/usePartners";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { useAuth } from "@/contexts/AuthContext";
import type { Partner } from "@/components/ui/searchable-partner-select";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { toast } from "sonner";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { BankStatementHeaderDialog } from "@/components/racunovodstvo/BankStatementHeaderDialog";
import { exportBankStatementToExcel, exportBankStatementPdf, printBankStatement } from "@/lib/bankStatementExportUtils";
import { BankStatementItemReviewDialog } from "@/components/racunovodstvo/BankStatementItemReviewDialog";

const STATUS_LABELS: Record<string, string> = { draft: "Nacrt", posted: "Proknjižen" };
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  posted: "default",
};

const TOGGLEABLE_COLUMNS = [
  { key: "payment_code", label: "Šifra plaćanja", width: 300 },
  { key: "partner", label: "Partner", width: 120 },
  { key: "partner_account", label: "TR partnera", width: 180 },
  { key: "account", label: "Konto", width: 120 },
  { key: "analytics", label: "Analitika", width: 100 },
  { key: "document", label: "Dokument", width: 140 },
  { key: "reference", label: "Poziv na broj", width: 150 },
  { key: "note", label: "Napomena", width: 150 },
] as const;

type ColumnKey = typeof TOGGLEABLE_COLUMNS[number]["key"];

const ALL_COLUMN_KEYS: ColumnKey[] = TOGGLEABLE_COLUMNS.map(c => c.key);
const STORAGE_KEY = "bank_statement_visible_columns";

const loadVisibleColumns = (): Set<ColumnKey> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const arr = JSON.parse(stored) as ColumnKey[];
      return new Set(arr);
    }
  } catch {}
  return new Set(ALL_COLUMN_KEYS);
};


interface EditingItemState {
  payment_code_id: string;
  partner_id: string;
  reference_number: string;
  description: string;
  document_reference: string;
  debit_amount: string;
  credit_amount: string;
  cost_center_code: string;
  partner_account_number: string;
}

const parseLocaleNumber = (value: string): number => {
  if (!value) return 0;
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
};

export default function BankStatementEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { data: statement, isLoading, refetch } = useBankStatement(id || null);
  const { data: items = [] } = useBankStatementItems(id || null);
  const { data: paymentCodes = [] } = usePaymentCodes();
  const { post, unpost, update } = useBankStatementMutations();
  const { addItem, updateItem, deleteItem } = useBankStatementItemMutations();
  const { partners = [] } = usePartners();
  const { data: accounts = [] } = useChartOfAccounts();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<EditingItemState | null>(null);
  const [unpostDialogOpen, setUnpostDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewItem, setReviewItem] = useState<BankStatementItem | null>(null);
  const [headerSerial, setHeaderSerial] = useState(statement?.bank_serial_number || "");
  const [headerOpeningBalance, setHeaderOpeningBalance] = useState(
    statement ? formatNumber(statement.opening_balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00"
  );

  useEffect(() => {
    if (statement) {
      setHeaderSerial(statement.bank_serial_number || "");
      setHeaderOpeningBalance(formatNumber(statement.opening_balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [statement?.bank_serial_number, statement?.opening_balance]);

  const [newItem, setNewItem] = useState({
    payment_code_id: "",
    partner_id: "",
    reference_number: "",
    description: "",
    document_reference: "",
    debit_amount: "0,00",
    credit_amount: "0,00",
    cost_center_code: "",
    partner_account_number: "",
  });

  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(loadVisibleColumns);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const isColVisible = (key: ColumnKey) => visibleColumns.has(key);


  if (isLoading || !statement) {
    return (
      <MainLayout title="Izvod">
        <div className="text-center py-8 text-muted-foreground">Učitavanje...</div>
      </MainLayout>
    );
  }

  const isDraft = statement.status === "draft";
  const totalDebit = items.reduce((s, i) => s + Number(i.debit_amount), 0);
  const totalCredit = items.reduce((s, i) => s + Number(i.credit_amount), 0);
  const activePaymentCodes = paymentCodes.filter((pc) => pc.is_active);

  // Build account code -> name map for display
  const accountMap = new Map(accounts.map((a) => [a.code, a.name]));
  const getAccountName = (accountCode: string | null | undefined) => {
    if (!accountCode) return null;
    return accountMap.get(accountCode) || null;
  };

  const startEdit = (item: BankStatementItem) => {
    setEditingId(item.id);
    setEditingData({
      payment_code_id: item.payment_code_id || "",
      partner_id: item.partner_id || "",
      reference_number: item.reference_number || "",
      description: item.description || "",
      document_reference: item.document_reference || "",
      debit_amount: formatNumber(item.debit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      credit_amount: formatNumber(item.credit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      cost_center_code: item.cost_center_code || "",
      partner_account_number: item.partner_account_number || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingData(null);
  };

  const saveEdit = async (item: BankStatementItem) => {
    if (!editingData || !id) return;
    const debit = parseLocaleNumber(editingData.debit_amount);
    const credit = parseLocaleNumber(editingData.credit_amount);

    const oldDebit = Number(item.debit_amount);
    const oldCredit = Number(item.credit_amount);

    await updateItem.mutateAsync({
      id: item.id,
      payment_code_id: editingData.payment_code_id || null,
      partner_id: editingData.partner_id || null,
      reference_number: editingData.reference_number || null,
      description: editingData.description || null,
      document_reference: editingData.document_reference || null,
      debit_amount: debit,
      credit_amount: credit,
      cost_center_code: editingData.cost_center_code || null,
      partner_account_number: editingData.partner_account_number || null,
    });

    // Update statement totals if amounts changed
    if (debit !== oldDebit || credit !== oldCredit) {
      await update.mutateAsync({
        id,
        total_debit: totalDebit - oldDebit + debit,
        total_credit: totalCredit - oldCredit + credit,
      });
    }

    setEditingId(null);
    setEditingData(null);
  };

  const handleAddItem = async () => {
    if (!id) return;
    const debit = parseLocaleNumber(newItem.debit_amount);
    const credit = parseLocaleNumber(newItem.credit_amount);
    if (debit === 0 && credit === 0) {
      toast.error("Unesite iznos uplate ili isplate");
      return;
    }

    await addItem.mutateAsync({
      bank_statement_id: id,
      item_order: items.length,
      payment_code_id: newItem.payment_code_id || null,
      partner_id: newItem.partner_id || null,
      reference_number: newItem.reference_number || null,
      description: newItem.description || null,
      document_reference: newItem.document_reference || null,
      debit_amount: debit,
      credit_amount: credit,
      cost_center_code: newItem.cost_center_code || null,
      partner_account_number: newItem.partner_account_number || null,
    });

    setNewItem({ payment_code_id: "", partner_id: "", reference_number: "", description: "", document_reference: "", debit_amount: "0,00", credit_amount: "0,00", cost_center_code: "", partner_account_number: "" });

    await update.mutateAsync({
      id,
      total_debit: totalDebit + debit,
      total_credit: totalCredit + credit,
    });
  };

  const handleDeleteItem = async (item: BankStatementItem) => {
    if (!id) return;
    await deleteItem.mutateAsync({ id: item.id, statementId: id });
    await update.mutateAsync({
      id,
      total_debit: totalDebit - Number(item.debit_amount),
      total_credit: totalCredit - Number(item.credit_amount),
    });
  };

  const handlePost = async () => {
    if (!id) return;
    if (confirm("Proknjižiti izvod?")) {
      await post.mutateAsync(id);
    }
  };

  const handleUnpost = async () => {
    if (!id) return;
    await unpost.mutateAsync(id);
    setUnpostDialogOpen(false);
  };

  const visibleToggleableCols = TOGGLEABLE_COLUMNS.filter(c => isColVisible(c.key));
  const calcMinWidth = () => {
    const fixed = 50 + 120 + 120 + 40 + (isDraft ? 80 : 0); // R.br. + Isplata + Uplata + ... + Akcije
    const toggled = visibleToggleableCols.reduce((s, c) => s + c.width, 0);
    return fixed + toggled;
  };

  const renderColgroup = () => (
    <colgroup>
      <col style={{ width: 50 }} />
      {isColVisible("payment_code") && <col style={{ width: 300 }} />}
      {isColVisible("partner") && <col style={{ width: 120 }} />}
      {isColVisible("partner_account") && <col style={{ width: 180 }} />}
      {isColVisible("account") && <col style={{ width: 120 }} />}
      {isColVisible("analytics") && <col style={{ width: 100 }} />}
      {isColVisible("document") && <col style={{ width: 140 }} />}
      {isColVisible("reference") && <col style={{ width: 150 }} />}
      {isColVisible("note") && <col style={{ width: 150 }} />}
      <col style={{ width: 120 }} />
      <col style={{ width: 120 }} />
      <col style={{ width: 40 }} />
      {isDraft && <col style={{ width: 80 }} />}
    </colgroup>
  );

  const renderItemRow = (item: BankStatementItem, idx: number) => {
    const isEditing = editingId === item.id && editingData;

    if (isEditing && isDraft) {
      return (
        <TableRow key={item.id} className="bg-muted/30">
          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
          {isColVisible("payment_code") && (
            <TableCell>
              <select
                value={editingData.payment_code_id}
                onChange={(e) => setEditingData({ ...editingData, payment_code_id: e.target.value })}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm truncate"
              >
                <option value="">Izaberite...</option>
                {activePaymentCodes.map((pc) => (
                  <option key={pc.id} value={pc.id}>
                    {pc.code} - {pc.name}
                  </option>
                ))}
              </select>
            </TableCell>
          )}
          {isColVisible("partner") && (
            <TableCell>
              <SearchablePartnerSelect
                partners={partners}
                value={editingData.partner_id}
                onValueChange={(v) => {
                  const p = partners.find((pp) => pp.id === v);
                  setEditingData({ ...editingData, partner_id: v, cost_center_code: p?.code || editingData.cost_center_code });
                }}
                placeholder="Partner..."
              />
            </TableCell>
          )}
          {isColVisible("partner_account") && (
            <TableCell>
              <Input
                value={editingData.partner_account_number}
                onChange={(e) => setEditingData({ ...editingData, partner_account_number: e.target.value })}
                className="h-8 text-sm font-mono"
                placeholder="TR partnera"
                autoComplete="off"
              />
            </TableCell>
          )}
          {isColVisible("account") && (
            <TableCell>
              {(() => {
                const pc = activePaymentCodes.find(p => p.id === editingData.payment_code_id);
                const code = pc?.account_code;
                const name = getAccountName(code);
                return code ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground font-mono cursor-default">{code}</span>
                      </TooltipTrigger>
                      {name && <TooltipContent side="top"><p>{name}</p></TooltipContent>}
                    </Tooltip>
                  </TooltipProvider>
                ) : "-";
              })()}
            </TableCell>
          )}
          {isColVisible("analytics") && (
            <TableCell>
              <Input
                value={editingData.cost_center_code}
                onChange={(e) => setEditingData({ ...editingData, cost_center_code: e.target.value })}
                className="h-8 text-sm font-mono"
                placeholder="Analitika"
                autoComplete="off"
              />
            </TableCell>
          )}
          {isColVisible("document") && (
            <TableCell>
              <Input
                value={editingData.document_reference}
                onChange={(e) => setEditingData({ ...editingData, document_reference: e.target.value })}
                className="h-8 text-sm"
                autoComplete="off"
              />
            </TableCell>
          )}
          {isColVisible("reference") && (
            <TableCell>
              <Input
                value={editingData.reference_number}
                onChange={(e) => setEditingData({ ...editingData, reference_number: e.target.value })}
                className="h-8 text-sm"
                placeholder="Poziv na broj"
                autoComplete="off"
              />
            </TableCell>
          )}
          {isColVisible("note") && (
            <TableCell>
              <Input
                value={editingData.description}
                onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                className="h-8 text-sm"
                placeholder="Napomena"
                autoComplete="off"
              />
            </TableCell>
          )}
          <TableCell>
            <LocaleNumberInput
              value={editingData.debit_amount}
              onChange={(val) => setEditingData({ ...editingData, debit_amount: val })}
              className="h-8 text-right font-mono"
            />
          </TableCell>
          <TableCell>
            <LocaleNumberInput
              value={editingData.credit_amount}
              onChange={(val) => setEditingData({ ...editingData, credit_amount: val })}
              className="h-8 text-right font-mono"
            />
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => saveEdit(item)}
                disabled={updateItem.isPending}
                className="h-7 w-7"
              >
                <Check className="w-4 h-4 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={cancelEdit}
                className="h-7 w-7"
              >
                <X className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );
    }

    return (
      <TableRow
        key={item.id}
        className={cn("group", isDraft && "cursor-pointer hover:bg-muted/50")}
        onDoubleClick={() => isDraft && startEdit(item)}
      >
        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
        {isColVisible("payment_code") && (
          <TableCell className="font-mono">
            {item.payment_code ? `${item.payment_code} - ${item.payment_name}` : "-"}
          </TableCell>
        )}
        {isColVisible("partner") && (
          <TableCell>
            {item.partner_code ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-mono cursor-default">{item.partner_code}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{item.partner_name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : "-"}
          </TableCell>
        )}
        {isColVisible("partner_account") && (
          <TableCell className="text-sm font-mono">{item.partner_account_number || "-"}</TableCell>
        )}
        {isColVisible("account") && (
          <TableCell className="text-sm">
            {item.payment_account_code ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-mono cursor-default">{item.payment_account_code}</span>
                  </TooltipTrigger>
                  {getAccountName(item.payment_account_code) && (
                    <TooltipContent side="top"><p>{getAccountName(item.payment_account_code)}</p></TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            ) : "-"}
          </TableCell>
        )}
        {isColVisible("analytics") && (
          <TableCell className="text-sm font-mono">{item.cost_center_code || "-"}</TableCell>
        )}
        {isColVisible("document") && (
          <TableCell className="text-sm">{item.document_reference || "-"}</TableCell>
        )}
        {isColVisible("reference") && (
          <TableCell className="text-sm">{item.reference_number || "-"}</TableCell>
        )}
        {isColVisible("note") && (
          <TableCell className="text-sm">{item.description || "-"}</TableCell>
        )}
        
        <TableCell className="text-right font-mono">
          {Number(item.debit_amount) !== 0 ? formatNumber(item.debit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
        </TableCell>
        <TableCell className="text-right font-mono">
          {Number(item.credit_amount) !== 0 ? formatNumber(item.credit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
        </TableCell>
        {isDraft && (
          <TableCell>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); startEdit(item); }}
                className="h-7 w-7"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Obrisati stavku?")) handleDeleteItem(item);
                }}
                disabled={deleteItem.isPending}
                className="h-7 w-7"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <MainLayout title="Izvod">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/racunovodstvo/izvodi")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Nazad
            </Button>
            <h1 className="text-xl font-semibold">{statement.statement_number}</h1>
            {statement.bank_serial_number && (
              <span className="text-sm text-muted-foreground">R.br. {statement.bank_serial_number}</span>
            )}
            <Badge variant={STATUS_VARIANTS[statement.status]}>
              {STATUS_LABELS[statement.status] || statement.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} title="Istorija izmena">
              <History className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()} title="Osveži">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              exportBankStatementToExcel({ statement, items, companyName: selectedCompany?.name ?? "" });
            }} title="Excel">
              <FileSpreadsheet className="w-4 h-4 mr-2" />Excel
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              await exportBankStatementPdf({ statement, items, companyName: selectedCompany?.name ?? "" });
            }} title="PDF">
              <FileDown className="w-4 h-4 mr-2" />PDF
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              await printBankStatement({ statement, items, companyName: selectedCompany?.name ?? "" });
            }} title="Štampa">
              <Printer className="w-4 h-4 mr-2" />Štampa
            </Button>
            {isDraft ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />Uredi zaglavlje
                </Button>
                {items.length > 0 && (
                  <Button size="sm" onClick={handlePost} disabled={post.isPending}>
                    <BookCheck className="w-4 h-4 mr-2" />
                    Proknjiži
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setHeaderDialogOpen(true)}>
                  <Eye className="h-4 w-4 mr-2" />Prikaži zaglavlje
                </Button>
                {statement.status === "posted" && (
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={() => setUnpostDialogOpen(true)}>
                    <Undo2 className="w-4 h-4 mr-2" />
                    Poništi knjiženje
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Statement info */}
        <div className="grid grid-cols-4 gap-4 text-sm border rounded-md p-4">
          <div>
            <span className="text-muted-foreground">Datum:</span>{" "}
            <span className="font-medium">{format(new Date(statement.statement_date), "dd.MM.yyyy.")}</span>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Tekući račun:</span>{" "}
            <span className="font-medium">
              {statement.bank_accounts?.account_number} - {statement.bank_accounts?.bank_name}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">R.br. izvoda banke:</span>{" "}
            {isDraft ? (
              <Input
                value={headerSerial}
                onChange={(e) => setHeaderSerial(e.target.value)}
                onBlur={() => {
                  if (headerSerial !== (statement.bank_serial_number || "")) {
                    update.mutate({ id: statement.id, bank_serial_number: headerSerial || null });
                  }
                }}
                className="inline-block h-7 w-24 ml-1 font-mono text-sm"
                placeholder="—"
                autoComplete="off"
              />
            ) : (
              <span className="font-mono font-medium">{statement.bank_serial_number || "—"}</span>
            )}
          </div>
        </div>

        {/* Balances & totals */}
        <div className="grid grid-cols-6 gap-4 text-sm border rounded-md p-4">
          <div>
            <span className="text-muted-foreground block">Prethodno stanje</span>
            {isDraft ? (
              <LocaleNumberInput
                value={headerOpeningBalance}
                onChange={(val) => setHeaderOpeningBalance(val)}
                onBlur={() => {
                  const num = parseLocaleNumber(headerOpeningBalance);
                  const formatted = formatNumber(num, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  setHeaderOpeningBalance(formatted);
                  if (num !== statement.opening_balance) {
                    update.mutate({ id: statement.id, opening_balance: num, closing_balance: num + totalCredit - totalDebit });
                  }
                }}
                className="h-7 w-full font-mono text-sm mt-1"
              />
            ) : (
              <span className="font-mono font-medium">{formatNumber(statement.opening_balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground block">Isplata (D)</span>
            <span className="font-mono font-semibold text-lg" style={{ color: "hsl(0, 80%, 45%)" }}>
              {formatNumber(totalDebit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Uplata (P)</span>
            <span className="font-mono font-semibold text-lg" style={{ color: "hsl(140, 70%, 35%)" }}>
              {formatNumber(totalCredit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Saldo (P-D)</span>
            <span className="font-mono font-bold text-lg" style={{ color: (totalCredit - totalDebit) >= 0 ? "hsl(140, 70%, 35%)" : "hsl(0, 80%, 45%)" }}>
              {formatNumber(totalCredit - totalDebit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Novo stanje</span>
            <span className="font-mono font-bold text-lg">
              {formatNumber(statement.opening_balance + totalCredit - totalDebit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Analitika TR</span>
            <span className="font-mono font-medium">{statement.bank_accounts?.code}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDraft && (
            <p className="text-xs text-muted-foreground">Dupli klik na red za izmenu stavke</p>
          )}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3 className="w-4 h-4 mr-2" />
                  Kolone
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="p-2 space-y-1 w-52">
                {TOGGLEABLE_COLUMNS.map(col => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={isColVisible(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Items table */}
        <div className="border rounded-md overflow-auto" style={{ maxHeight: "calc(100vh - 380px)" }}>
          <div style={{ minWidth: calcMinWidth() }}>
            <Table className="table-fixed">
              {renderColgroup()}
              <TableHeader className="sticky top-0 z-20 bg-background">
                 <TableRow>
                   <TableHead>R.br.</TableHead>
                   {isColVisible("payment_code") && <TableHead>Šifra plaćanja</TableHead>}
                   {isColVisible("partner") && <TableHead>Partner</TableHead>}
                   {isColVisible("partner_account") && <TableHead>TR partnera</TableHead>}
                   {isColVisible("account") && <TableHead>Konto</TableHead>}
                   {isColVisible("analytics") && <TableHead>Analitika</TableHead>}
                   {isColVisible("document") && <TableHead>Dokument</TableHead>}
                   {isColVisible("reference") && <TableHead>Poziv na broj</TableHead>}
                   {isColVisible("note") && <TableHead>Napomena</TableHead>}
                   <TableHead className="text-right">Isplata (D)</TableHead>
                   <TableHead className="text-right">Uplata (P)</TableHead>
                   {isDraft && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && !isDraft ? (
                  <TableRow>
                    <TableCell colSpan={visibleToggleableCols.length + 3 + (isDraft ? 1 : 0)} className="text-center py-4 text-muted-foreground">Nema stavki</TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => renderItemRow(item, idx))
                )}
                {/* New item row */}
                {isDraft && (
                  <TableRow className="bg-muted/50 border-t-2">
                    <TableCell className="text-muted-foreground">{items.length + 1}</TableCell>
                    {isColVisible("payment_code") && (
                      <TableCell>
                        <select
                          value={newItem.payment_code_id}
                          onChange={(e) => setNewItem({ ...newItem, payment_code_id: e.target.value })}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm truncate"
                        >
                          <option value="">Izaberite...</option>
                          {activePaymentCodes.map((pc) => (
                            <option key={pc.id} value={pc.id}>
                              {pc.code} - {pc.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                    )}
                    {isColVisible("partner") && (
                      <TableCell>
                        <SearchablePartnerSelect
                          partners={partners}
                          value={newItem.partner_id}
                          onValueChange={(v) => {
                            const p = partners.find((pp) => pp.id === v);
                            setNewItem({ ...newItem, partner_id: v, cost_center_code: p?.code || newItem.cost_center_code });
                          }}
                          placeholder="Partner..."
                        />
                      </TableCell>
                    )}
                    {isColVisible("partner_account") && (
                      <TableCell>
                        <Input
                          value={newItem.partner_account_number}
                          onChange={(e) => setNewItem({ ...newItem, partner_account_number: e.target.value })}
                          placeholder="TR partnera"
                          className="h-8 text-sm font-mono"
                          autoComplete="off"
                        />
                      </TableCell>
                    )}
                    {isColVisible("account") && (
                      <TableCell>
                        {(() => {
                          const pc = activePaymentCodes.find(p => p.id === newItem.payment_code_id);
                          const code = pc?.account_code;
                          const name = getAccountName(code);
                          return code ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs text-muted-foreground font-mono cursor-default">{code}</span>
                                </TooltipTrigger>
                                {name && <TooltipContent side="top"><p>{name}</p></TooltipContent>}
                              </Tooltip>
                            </TooltipProvider>
                          ) : "-";
                        })()}
                      </TableCell>
                    )}
                    {isColVisible("analytics") && (
                      <TableCell>
                        <Input
                          value={newItem.cost_center_code}
                          onChange={(e) => setNewItem({ ...newItem, cost_center_code: e.target.value })}
                          placeholder="Analitika"
                          className="h-8 text-sm font-mono"
                          autoComplete="off"
                        />
                      </TableCell>
                    )}
                    {isColVisible("document") && (
                      <TableCell>
                        <Input
                          value={newItem.document_reference}
                          onChange={(e) => setNewItem({ ...newItem, document_reference: e.target.value })}
                          placeholder="Dokument"
                          className="h-8 text-sm"
                          autoComplete="off"
                        />
                      </TableCell>
                    )}
                    {isColVisible("reference") && (
                      <TableCell>
                        <Input
                          value={newItem.reference_number}
                          onChange={(e) => setNewItem({ ...newItem, reference_number: e.target.value })}
                          placeholder="Poziv na broj"
                          className="h-8 text-sm"
                          autoComplete="off"
                        />
                      </TableCell>
                    )}
                    {isColVisible("note") && (
                      <TableCell>
                        <Input
                          value={newItem.description}
                          onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                          placeholder="Napomena"
                          className="h-8 text-sm"
                          autoComplete="off"
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <LocaleNumberInput
                        value={newItem.debit_amount}
                        onChange={(val) => setNewItem(prev => {
                          const num = parseLocaleNumber(val);
                          return { ...prev, debit_amount: val, ...(num > 0 ? { credit_amount: "0,00" } : {}) };
                        })}
                        className="h-8 text-right font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <LocaleNumberInput
                        value={newItem.credit_amount}
                        onChange={(val) => setNewItem(prev => {
                          const num = parseLocaleNumber(val);
                          return { ...prev, credit_amount: val, ...(num > 0 ? { debit_amount: "0,00" } : {}) };
                        })}
                        className="h-8 text-right font-mono"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleAddItem}
                          disabled={addItem.isPending}
                          className="h-7 w-7"
                          title="Dodaj stavku"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        {(newItem.payment_code_id || newItem.partner_id || newItem.reference_number || newItem.description || newItem.document_reference || newItem.cost_center_code || newItem.partner_account_number || parseLocaleNumber(newItem.debit_amount) !== 0 || parseLocaleNumber(newItem.credit_amount) !== 0) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setNewItem({ payment_code_id: "", partner_id: "", reference_number: "", description: "", document_reference: "", debit_amount: "0,00", credit_amount: "0,00", cost_center_code: "", partner_account_number: "" })}
                            className="h-7 w-7"
                            title="Poništi unos"
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={visibleToggleableCols.length + 1} className="text-right font-medium">Ukupno:</TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber(totalDebit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold">
                    {formatNumber(totalCredit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  {isDraft && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      </div>

      <AlertDialog open={unpostDialogOpen} onOpenChange={setUnpostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Poništavanje knjiženja</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da poništite knjiženje izvoda{" "}
              <strong>{statement.statement_number}</strong>?
              <br /><br />
              Povezani nalog za knjiženje će biti obrisan iz Glavne knjige.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnpost}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Poništi knjiženje
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BankStatementHeaderDialog
        open={headerDialogOpen}
        onOpenChange={setHeaderDialogOpen}
        statement={statement}
        readOnly={!isDraft}
        onSaved={() => refetch()}
      />

      <DocumentHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        documentId={id || ""}
        documentType="bank_statement"
        documentName={`Izvod ${statement.statement_number}`}
      />
    </MainLayout>
  );
}
