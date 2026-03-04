import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, BookCheck, Undo2 } from "lucide-react";
import {
  useBankStatement,
  useBankStatementItems,
  useBankStatementMutations,
  useBankStatementItemMutations,
  BankStatementItem,
} from "@/hooks/useBankStatements";
import { usePaymentCodes } from "@/hooks/usePaymentCodes";
import { usePartners } from "@/hooks/usePartners";
import { useAuth } from "@/contexts/AuthContext";
import type { Partner } from "@/components/ui/searchable-partner-select";
import { format } from "date-fns";
import { formatNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";

const STATUS_LABELS: Record<string, string> = { draft: "Nacrt", posted: "Proknjižen" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  posted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function BankStatementEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedCompany } = useAuth();
  const { data: statement, isLoading } = useBankStatement(id || null);
  const { data: items = [] } = useBankStatementItems(id || null);
  const { data: paymentCodes = [] } = usePaymentCodes();
  const { post, unpost, update } = useBankStatementMutations();
  const { addItem, deleteItem } = useBankStatementItemMutations();
  const { partners = [] } = usePartners();

  const [newItem, setNewItem] = useState({
    payment_code_id: "",
    partner_id: "",
    reference_number: "",
    description: "",
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

  const parseLocaleNumber = (value: string): number => {
    if (!value) return 0;
    return parseFloat(value.replace(/\./g, "").replace(",", ".")) || 0;
  };

  const handleAddItem = async () => {
    if (!id || !newItem.payment_code_id) return;
    const debit = parseLocaleNumber(newItem.debit_amount);
    const credit = parseLocaleNumber(newItem.credit_amount);
    if (debit === 0 && credit === 0) return;

    await addItem.mutateAsync({
      bank_statement_id: id,
      item_order: items.length,
      payment_code_id: newItem.payment_code_id || null,
      partner_id: newItem.partner_id || null,
      reference_number: newItem.reference_number || null,
      description: newItem.description || null,
      debit_amount: debit,
      credit_amount: credit,
    });

    setNewItem({ payment_code_id: "", partner_id: "", reference_number: "", description: "", debit_amount: "0,00", credit_amount: "0,00" });

    // Update totals
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
          <div className="col-span-2">
            <span className="text-muted-foreground">Tekući račun:</span>{" "}
            <span className="font-medium">
              {statement.bank_accounts?.account_number} - {statement.bank_accounts?.bank_name}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Analitika TR:</span>{" "}
            <span className="font-mono font-medium">{statement.bank_accounts?.code}</span>
          </div>
        </div>

        {/* Items table */}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">R.br.</TableHead>
                <TableHead className="w-[140px]">Šifra plaćanja</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead className="w-[140px]">Poziv na broj</TableHead>
                <TableHead>Opis</TableHead>
                <TableHead className="w-[130px] text-right">Uplata (D)</TableHead>
                <TableHead className="w-[130px] text-right">Isplata (P)</TableHead>
                {isDraft && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && !isDraft ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">Nema stavki</TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-mono">
                      {item.payment_code ? `${item.payment_code} - ${item.payment_name}` : "-"}
                    </TableCell>
                    <TableCell>{item.partner_name ? `[${item.partner_code}] ${item.partner_name}` : "-"}</TableCell>
                    <TableCell className="font-mono text-sm">{item.reference_number || "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{item.description || "-"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(item.debit_amount) !== 0 ? formatNumber(item.debit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(item.credit_amount) !== 0 ? formatNumber(item.credit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                    </TableCell>
                    {isDraft && (
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(item)} disabled={deleteItem.isPending}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
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
                    <Input
                      value={newItem.reference_number}
                      onChange={(e) => setNewItem({ ...newItem, reference_number: e.target.value })}
                      placeholder="Poziv na br."
                      className="h-8 font-mono text-sm"
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
                      onChange={(val) => setNewItem({ ...newItem, debit_amount: val, credit_amount: "0,00" })}
                      className="h-8 text-right font-mono"
                    />
                  </TableCell>
                  <TableCell>
                    <LocaleNumberInput
                      value={newItem.credit_amount}
                      onChange={(val) => setNewItem({ ...newItem, credit_amount: val, debit_amount: "0,00" })}
                      className="h-8 text-right font-mono"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleAddItem}
                      disabled={!newItem.payment_code_id || (parseLocaleNumber(newItem.debit_amount) === 0 && parseLocaleNumber(newItem.credit_amount) === 0) || addItem.isPending}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="text-right font-medium">Ukupno:</TableCell>
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
