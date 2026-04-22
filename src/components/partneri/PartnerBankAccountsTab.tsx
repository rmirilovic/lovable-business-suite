import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { usePartnerBankAccounts } from "@/hooks/usePartners";
import { useAuth } from "@/contexts/AuthContext";
import { InlineEditCell } from "@/components/sifarnici/InlineEditCell";
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

interface PartnerBankAccountsTabProps {
  partnerId: string;
}

export function PartnerBankAccountsTab({ partnerId }: PartnerBankAccountsTabProps) {
  const { selectedCompany } = useAuth();
  const {
    bankAccounts,
    isLoading,
    createBankAccount,
    updateBankAccount,
    deleteBankAccount,
    reorderBankAccounts,
    isCreating,
  } = usePartnerBankAccounts(partnerId);

  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedCompany || !newAccountNumber.trim()) return;

    await createBankAccount({
      partner_id: partnerId,
      company_id: selectedCompany.id,
      account_number: newAccountNumber.trim(),
      sort_order: bankAccounts.length,
    });

    setNewAccountNumber("");
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteBankAccount(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = bankAccounts.findIndex((a) => a.id === draggedId);
    const targetIndex = bankAccounts.findIndex((a) => a.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...bankAccounts];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    const updates = newOrder.map((account, index) => ({
      id: account.id,
      sort_order: index,
    }));

    await reorderBankAccounts(updates);
    setDraggedId(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Povucite redove da promenite redosled. Prvi račun na listi je podrazumevani.
      </p>

      {/* Add new account */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={newAccountNumber}
          onChange={(e) => setNewAccountNumber(e.target.value.replace(/[^\d-]/g, ""))}
          placeholder="Broj tekućeg računa (samo brojevi i crtice)"
          className="flex-1"
          autoComplete="off"
          inputMode="numeric"
        />
        <Button
          onClick={handleCreate}
          disabled={isCreating || !newAccountNumber.trim()}
          className="w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-1" />
          Dodaj
        </Button>
      </div>

      {/* Accounts table */}
      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Broj računa</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Učitavanje...
                </TableCell>
              </TableRow>
            ) : bankAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Nema definisanih tekućih računa
                </TableCell>
              </TableRow>
            ) : (
              bankAccounts.map((account, index) => (
                <TableRow
                  key={account.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, account.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, account.id)}
                  className={`cursor-move ${draggedId === account.id ? "opacity-50" : ""}`}
                >
                  <TableCell>
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-mono">
                    <div className="flex flex-wrap items-center gap-2">
                      {index === 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded whitespace-nowrap">
                          Podrazumevani
                        </span>
                      )}
                      <InlineEditCell
                        value={account.account_number}
                        onSave={async (val) => {
                          await updateBankAccount({
                            id: account.id,
                            updates: { account_number: val },
                          });
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirmId(account.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje računa</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete ovaj tekući račun?
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
    </div>
  );
}
