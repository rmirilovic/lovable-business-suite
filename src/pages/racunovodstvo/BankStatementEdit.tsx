import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
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
import { ArrowLeft, Plus, Trash2, BookCheck, Undo2, Pencil, Check, X, RefreshCw, History, Eye, FileDown, FileSpreadsheet, Printer } from "lucide-react";
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

const STATUS_LABELS: Record<string, string> = { draft: "Nacrt", posted: "Proknjižen" };
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary",
  posted: "default",
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
  const [headerSerial, setHeaderSerial] = useState(statement?.bank_serial_number || "");
  const [headerOpeningBalance, setHeaderOpeningBalance] = useState(
    statement ? formatNumber(statement.opening_balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00"
  );

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
  const getAccountLabel = (accountCode: string | null | undefined) => {
    if (!accountCode) return "-";
    const name = accountMap.get(accountCode);
    return name ? `${accountCode} - ${name}` : accountCode;
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

  const renderItemRow = (item: BankStatementItem, idx: number) => {
    const isEditing = editingId === item.id && editingData;

    if (isEditing && isDraft) {
      return (
        <TableRow key={item.id} className="bg-muted/30">
          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
          <TableCell>
            <select
              value={editingData.payment_code_id}
              onChange={(e) => setEditingData({ ...editingData, payment_code_id: e.target.value })}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Izaberite...</option>
              {activePaymentCodes.map((pc) => (
                <option key={pc.id} value={pc.id}>
                  {pc.code} - {pc.name}
                </option>
              ))}
            </select>
          </TableCell>
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
          <TableCell>
            <Input
              value={editingData.partner_account_number}
              onChange={(e) => setEditingData({ ...editingData, partner_account_number: e.target.value })}
              className="h-8 text-sm font-mono"
              placeholder="TR partnera"
              autoComplete="off"
            />
          </TableCell>
          <TableCell>
            <span className="text-xs text-muted-foreground">
              {(() => {
                const pc = activePaymentCodes.find(p => p.id === editingData.payment_code_id);
                return pc ? getAccountLabel(pc.account_code) : "-";
              })()}
            </span>
          </TableCell>
          <TableCell>
            <Input
              value={editingData.cost_center_code}
              onChange={(e) => setEditingData({ ...editingData, cost_center_code: e.target.value })}
              className="h-8 text-sm font-mono"
              placeholder="Analitika"
              autoComplete="off"
            />
          </TableCell>
          <TableCell>
            <Input
              value={editingData.document_reference}
              onChange={(e) => setEditingData({ ...editingData, document_reference: e.target.value })}
              className="h-8 text-sm"
              autoComplete="off"
            />
          </TableCell>
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
        <TableCell className="font-mono">
          {item.payment_code ? `${item.payment_code} - ${item.payment_name}` : "-"}
        </TableCell>
        <TableCell>{item.partner_name ? `[${item.partner_code}] ${item.partner_name}` : "-"}</TableCell>
        <TableCell className="text-sm font-mono">{item.partner_account_number || "-"}</TableCell>
        <TableCell className="text-sm">{getAccountLabel(item.payment_account_code)}</TableCell>
        <TableCell className="text-sm font-mono">{item.cost_center_code || "-"}</TableCell>
        <TableCell className="text-sm">{item.document_reference || "-"}</TableCell>
        
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

        {isDraft && (
          <p className="text-xs text-muted-foreground">Dupli klik na red za izmenu stavke</p>
        )}

        {/* Items table */}
        <div className="border rounded-md flex flex-col" style={{ maxHeight: "calc(100vh - 380px)" }}>
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-[50px]">R.br.</TableHead>
                  <TableHead className="w-[350px]">Šifra plaćanja</TableHead>
                  <TableHead className="w-[300px]">Partner</TableHead>
                  <TableHead className="w-[200px]">TR partnera</TableHead>
                   <TableHead className="w-[300px]">Konto</TableHead>
                   <TableHead className="w-[100px]">Analitika</TableHead>
                   <TableHead className="w-[140px]">Dokument</TableHead>
                  <TableHead className="w-[130px] text-right">Isplata (D)</TableHead>
                  <TableHead className="w-[130px] text-right">Uplata (P)</TableHead>
                  {isDraft && <TableHead className="w-[80px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && !isDraft ? (
                  <TableRow>
                    <TableCell colSpan={isDraft ? 11 : 10} className="text-center py-4 text-muted-foreground">Nema stavki</TableCell>
                  </TableRow>
                ) : (
                  items.map((item, idx) => renderItemRow(item, idx))
                )}
              </TableBody>
            </Table>
          </div>
          {/* New item row - outside scroll area */}
          {isDraft && (
            <div className="border-t">
              <Table>
                <TableBody>
                  <TableRow className="bg-muted/50">
                    <TableCell className="w-[50px] text-muted-foreground">{items.length + 1}</TableCell>
                    <TableCell className="w-[350px]">
                      <select
                        value={newItem.payment_code_id}
                        onChange={(e) => setNewItem({ ...newItem, payment_code_id: e.target.value })}
                        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="">Izaberite...</option>
                        {activePaymentCodes.map((pc) => (
                          <option key={pc.id} value={pc.id}>
                            {pc.code} - {pc.name}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="w-[350px]">
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
                    <TableCell className="w-[200px]">
                      <Input
                        value={newItem.partner_account_number}
                        onChange={(e) => setNewItem({ ...newItem, partner_account_number: e.target.value })}
                        placeholder="TR partnera"
                        className="h-8 text-sm font-mono"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell className="w-[180px]">
                      <span className="text-xs text-muted-foreground">
                        {(() => {
                          const pc = activePaymentCodes.find(p => p.id === newItem.payment_code_id);
                          return pc ? getAccountLabel(pc.account_code) : "-";
                        })()}
                      </span>
                    </TableCell>
                    <TableCell className="w-[100px]">
                      <Input
                        value={newItem.cost_center_code}
                        onChange={(e) => setNewItem({ ...newItem, cost_center_code: e.target.value })}
                        placeholder="Analitika"
                        className="h-8 text-sm font-mono"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell className="w-[140px]">
                      <Input
                        value={newItem.document_reference}
                        onChange={(e) => setNewItem({ ...newItem, document_reference: e.target.value })}
                        placeholder="Dokument"
                        className="h-8 text-sm"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell className="w-[130px]">
                      <LocaleNumberInput
                        value={newItem.debit_amount}
                        onChange={(val) => setNewItem(prev => {
                          const num = parseLocaleNumber(val);
                          return { ...prev, debit_amount: val, ...(num > 0 ? { credit_amount: "0,00" } : {}) };
                        })}
                        className="h-8 text-right font-mono"
                      />
                    </TableCell>
                    <TableCell className="w-[130px]">
                      <LocaleNumberInput
                        value={newItem.credit_amount}
                        onChange={(val) => setNewItem(prev => {
                          const num = parseLocaleNumber(val);
                          return { ...prev, credit_amount: val, ...(num > 0 ? { debit_amount: "0,00" } : {}) };
                        })}
                        className="h-8 text-right font-mono"
                      />
                    </TableCell>
                    <TableCell className="w-[80px]">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleAddItem}
                        disabled={addItem.isPending}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
          {/* Footer totals - outside scroll area */}
          <div className="border-t">
            <Table>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={8} className="text-right font-medium">Ukupno:</TableCell>
                  <TableCell className="w-[130px] text-right font-mono font-bold">
                    {formatNumber(totalDebit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="w-[130px] text-right font-mono font-bold">
                    {formatNumber(totalCredit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  {isDraft && <TableCell className="w-[80px]" />}
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
