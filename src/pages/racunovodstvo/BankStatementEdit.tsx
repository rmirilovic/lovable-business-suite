import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, BookCheck, Undo2, Pencil, Check, X } from "lucide-react";
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

const STATUS_LABELS: Record<string, string> = { draft: "Nacrt", posted: "Proknjižen" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

interface EditingItemState {
  payment_code_id: string;
  partner_id: string;
  reference_number: string;
  description: string;
  document_reference: string;
  debit_amount: string;
  credit_amount: string;
}

const parseLocaleNumber = (value: string): number => {
  if (!value) return 0;
  return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
};

export default function BankStatementEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { data: statement, isLoading } = useBankStatement(id || null);
  const { data: items = [] } = useBankStatementItems(id || null);
  const { data: paymentCodes = [] } = usePaymentCodes();
  const { post, unpost, update } = useBankStatementMutations();
  const { addItem, updateItem, deleteItem } = useBankStatementItemMutations();
  const { partners = [] } = usePartners();
  const { data: accounts = [] } = useChartOfAccounts();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<EditingItemState | null>(null);
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
    });

    setNewItem({ payment_code_id: "", partner_id: "", reference_number: "", description: "", document_reference: "", debit_amount: "0,00", credit_amount: "0,00" });

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
    if (confirm("Poništiti knjiženje izvoda?")) {
      await unpost.mutateAsync(id);
    }
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
              onValueChange={(v) => setEditingData({ ...editingData, partner_id: v })}
              placeholder="Partner..."
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
              value={editingData.document_reference}
              onChange={(e) => setEditingData({ ...editingData, document_reference: e.target.value })}
              className="h-8 text-sm"
              autoComplete="off"
            />
          </TableCell>
          <TableCell>
            <Input
              value={editingData.description}
              onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
              className="h-8"
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
        <TableCell className="text-sm">{getAccountLabel(item.payment_account_code)}</TableCell>
        <TableCell className="text-sm">{item.document_reference || "-"}</TableCell>
        <TableCell className="text-muted-foreground">{item.description || "-"}</TableCell>
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
    <MainLayout title={`Izvod ${statement.statement_number}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/racunovodstvo/izvodi")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Nazad
          </Button>
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs", STATUS_COLORS[statement.status] || "")}>
              {STATUS_LABELS[statement.status] || statement.status}
            </Badge>
            {isDraft && items.length > 0 && (
              <Button onClick={handlePost} disabled={post.isPending}>
                <BookCheck className="w-4 h-4 mr-2" />
                Proknjiži
              </Button>
            )}
            {statement.status === "posted" && (
              <Button variant="outline" onClick={handleUnpost} disabled={unpost.isPending}>
                <Undo2 className="w-4 h-4 mr-2" />
                Poništi
              </Button>
            )}
          </div>
        </div>

        {/* Statement info */}
        <div className="grid grid-cols-4 gap-4 text-sm border rounded-md p-4">
          <div>
            <span className="text-muted-foreground">Datum:</span>{" "}
            <span className="font-medium">{format(new Date(statement.statement_date), "dd.MM.yyyy.")}</span>
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
          <div className="col-span-2">
            <span className="text-muted-foreground">Tekući račun:</span>{" "}
            <span className="font-medium">
              {statement.bank_accounts?.account_number} - {statement.bank_accounts?.bank_name}
            </span>
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
                    update.mutate({ id: statement.id, opening_balance: num, closing_balance: num + totalDebit - totalCredit });
                  }
                }}
                className="h-7 w-full font-mono text-sm mt-1"
              />
            ) : (
              <span className="font-mono font-medium">{formatNumber(statement.opening_balance, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            )}
          </div>
          <div>
            <span className="text-muted-foreground block">Duguje</span>
            <span className="font-mono font-medium text-green-700 dark:text-green-400">
              {formatNumber(totalDebit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Potražuje</span>
            <span className="font-mono font-medium text-red-700 dark:text-red-400">
              {formatNumber(totalCredit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Saldo (D-P)</span>
            <span className={cn("font-mono font-bold", (totalDebit - totalCredit) >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
              {formatNumber(totalDebit - totalCredit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block">Novo stanje</span>
            <span className="font-mono font-bold">
              {formatNumber(statement.opening_balance + totalDebit - totalCredit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">R.br.</TableHead>
                <TableHead className="w-[350px]">Šifra plaćanja</TableHead>
                <TableHead className="w-[200px]">Partner</TableHead>
                <TableHead className="w-[180px]">Konto</TableHead>
                <TableHead className="w-[140px]">Dokument</TableHead>
                <TableHead className="max-w-[140px]">Opis</TableHead>
                <TableHead className="w-[130px] text-right">Uplata (D)</TableHead>
                <TableHead className="w-[130px] text-right">Isplata (P)</TableHead>
                {isDraft && <TableHead className="w-[80px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && !isDraft ? (
                <TableRow>
                  <TableCell colSpan={isDraft ? 9 : 8} className="text-center py-4 text-muted-foreground">Nema stavki</TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => renderItemRow(item, idx))
              )}

              {/* New item row */}
              {isDraft && (
                <TableRow className="bg-muted/50">
                  <TableCell className="text-muted-foreground">{items.length + 1}</TableCell>
                  <TableCell>
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
                  <TableCell>
                    <SearchablePartnerSelect
                      partners={partners}
                      value={newItem.partner_id}
                      onValueChange={(v) => setNewItem({ ...newItem, partner_id: v })}
                      placeholder="Partner..."
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const pc = activePaymentCodes.find(p => p.id === newItem.payment_code_id);
                        return pc ? getAccountLabel(pc.account_code) : "-";
                      })()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newItem.document_reference}
                      onChange={(e) => setNewItem({ ...newItem, document_reference: e.target.value })}
                      placeholder="Dokument"
                      className="h-8 text-sm"
                      autoComplete="off"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newItem.description}
                      onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                      placeholder="Opis"
                      className="h-8"
                      autoComplete="off"
                    />
                  </TableCell>
                  <TableCell>
                    <LocaleNumberInput
                      value={newItem.debit_amount}
                      onChange={(val) => setNewItem(prev => ({ ...prev, debit_amount: val, credit_amount: "0,00" }))}
                      className="h-8 text-right font-mono"
                    />
                  </TableCell>
                  <TableCell>
                    <LocaleNumberInput
                      value={newItem.credit_amount}
                      onChange={(val) => setNewItem(prev => ({ ...prev, credit_amount: val, debit_amount: "0,00" }))}
                      className="h-8 text-right font-mono"
                    />
                  </TableCell>
                  <TableCell>
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
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={6} className="text-right font-medium">Ukupno:</TableCell>
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
    </MainLayout>
  );
}
