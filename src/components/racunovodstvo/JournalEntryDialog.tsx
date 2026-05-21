import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  TableFooter,
} from "@/components/ui/table";
import { Plus, Trash2, BookCheck } from "lucide-react";
import {
  JournalEntry,
  JournalEntryItem,
  useJournalEntryItems,
  useJournalEntryItemMutations,
  useJournalEntryMutations,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/hooks/useJournalEntries";
import { useChartOfAccounts } from "@/hooks/useChartOfAccounts";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { formatNumber, parseLocaleNumber } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";

interface JournalEntryDialogProps {
  entry: JournalEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JournalEntryDialog({ entry, open, onOpenChange }: JournalEntryDialogProps) {
  const { data: items = [], isLoading: itemsLoading } = useJournalEntryItems(entry?.id ?? null);
  const { data: accounts = [] } = useChartOfAccounts();
  const { addItem, deleteItem } = useJournalEntryItemMutations();
  const { postEntry } = useJournalEntryMutations();

  const [newItem, setNewItem] = useState({
    account_code: "",
    description: "",
    debit_amount: "0,00",
    credit_amount: "0,00",
  });

  const postingAccounts = accounts.filter((a) => a.is_posting_allowed);
  const isDraft = entry?.status === "draft";

  const totalDebit = items.reduce((sum, item) => sum + Number(item.debit_amount), 0);
  const totalCredit = items.reduce((sum, item) => sum + Number(item.credit_amount), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const getAccountName = (code: string) => {
    const account = accounts.find((a) => a.code === code);
    return account?.name || "";
  };


  const handleAddItem = async () => {
    if (!entry?.id || !newItem.account_code) return;

    const debit = parseLocaleNumber(newItem.debit_amount);
    const credit = parseLocaleNumber(newItem.credit_amount);

    await addItem.mutateAsync({
      journal_entry_id: entry.id,
      account_code: newItem.account_code,
      description: newItem.description || null,
      debit_amount: debit,
      credit_amount: credit,
      item_order: items.length,
      partner_id: null,
      cost_center_code: null,
      document_date: null,
      item_document_number: null,
      item_document_date: null,
    });

    setNewItem({
      account_code: "",
      description: "",
      debit_amount: "0,00",
      credit_amount: "0,00",
    });
  };

  const handleDeleteItem = async (item: JournalEntryItem) => {
    if (!entry?.id) return;
    await deleteItem.mutateAsync({ id: item.id, entryId: entry.id });
  };

  const handlePost = async () => {
    if (!entry?.id) return;
    if (confirm("Da li ste sigurni da želite da proknjižite nalog? Ova akcija se ne može poništiti.")) {
      await postEntry.mutateAsync(entry.id);
      onOpenChange(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onFocusOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <span>Nalog #{entry.entry_number}</span>
              <Badge className={cn("text-xs", STATUS_COLORS[entry.status])}>
                {STATUS_LABELS[entry.status]}
              </Badge>
            </DialogTitle>
            {isDraft && isBalanced && (
              <Button onClick={handlePost} disabled={postEntry.isPending}>
                <BookCheck className="w-4 h-4 mr-2" />
                Proknjiži
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 overflow-auto flex-1">
          {/* Header info */}
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Datum:</span>{" "}
              <span className="font-medium">{format(new Date(entry.entry_date), "dd.MM.yyyy.", { locale: sr })}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Dokument:</span>{" "}
              <span className="font-medium">{entry.document_number || "-"}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Opis:</span>{" "}
              <span className="font-medium">{entry.description}</span>
            </div>
          </div>

          {/* Items table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Konto</TableHead>
                  <TableHead>Naziv konta</TableHead>
                  <TableHead>Opis stavke</TableHead>
                  <TableHead className="w-[140px]">Dokument</TableHead>
                  <TableHead className="w-[120px] text-right">Duguje</TableHead>
                  <TableHead className="w-[120px] text-right">Potražuje</TableHead>
                  {isDraft && <TableHead className="w-[60px]" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsLoading ? (
                  <TableRow>
                    <TableCell colSpan={isDraft ? 7 : 6} className="text-center py-4">
                      Učitavanje...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isDraft ? 7 : 6} className="text-center py-4 text-muted-foreground">
                      Nema stavki. Dodajte prvu stavku ispod.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.account_code}</TableCell>
                      <TableCell>{getAccountName(item.account_code)}</TableCell>
                      <TableCell className="text-muted-foreground">{item.description || "-"}</TableCell>
                      <TableCell className="text-xs">
                        <div className="leading-tight">
                          {item.item_document_number || entry.document_number || "-"}
                          {(item.item_document_date || entry.document_date) && (
                            <div className="text-muted-foreground text-[10px]">
                              {format(new Date(item.item_document_date || entry.document_date!), "dd.MM.yyyy.", { locale: sr })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(item.debit_amount) > 0 ? formatNumber(item.debit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {Number(item.credit_amount) > 0 ? formatNumber(item.credit_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
                      </TableCell>
                      {isDraft && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem(item)}
                            disabled={deleteItem.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}

                {/* Add new item row */}
                {isDraft && (
                  <TableRow className="bg-muted/50">
                    <TableCell>
                      <Input
                        list="accounts-list"
                        value={newItem.account_code}
                        onChange={(e) => setNewItem({ ...newItem, account_code: e.target.value })}
                        placeholder="Konto"
                        className="h-8 font-mono"
                        autoComplete="off"
                      />
                      <datalist id="accounts-list">
                        {postingAccounts.map((acc) => (
                          <option key={acc.id} value={acc.code}>
                            {acc.name}
                          </option>
                        ))}
                      </datalist>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getAccountName(newItem.account_code)}
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
                    <TableCell />
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
                        disabled={!newItem.account_code || (parseLocaleNumber(newItem.debit_amount) === 0 && parseLocaleNumber(newItem.credit_amount) === 0) || addItem.isPending}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">
                    Ukupno:
                  </TableCell>
                  <TableCell className={cn("text-right font-mono font-bold", !isBalanced && "text-destructive")}>
                    {formatNumber(totalDebit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className={cn("text-right font-mono font-bold", !isBalanced && "text-destructive")}>
                    {formatNumber(totalCredit, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  {isDraft && <TableCell />}
                </TableRow>
                {!isBalanced && items.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={isDraft ? 7 : 6} className="text-center text-destructive text-sm">
                      ⚠️ Nalog nije uravnotežen! Razlika: {formatNumber(Math.abs(totalDebit - totalCredit), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                )}
              </TableFooter>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
