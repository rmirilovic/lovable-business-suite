import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { usePartnerGroups, PartnerGroup } from "@/hooks/usePartners";
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

interface PartnerGroupsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PartnerGroupsDialog({ open, onOpenChange }: PartnerGroupsDialogProps) {
  const { selectedCompany } = useAuth();
  const { groups, isLoading, createGroup, updateGroup, deleteGroup, isCreating } = usePartnerGroups();
  
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!selectedCompany || !newCode.trim() || !newName.trim()) return;
    
    await createGroup({
      company_id: selectedCompany.id,
      code: newCode.trim(),
      name: newName.trim(),
    });
    
    setNewCode("");
    setNewName("");
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteGroup(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Grupe partnera</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add new group form */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="newCode">Šifra</Label>
                <Input
                  id="newCode"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Šifra grupe"
                  autoComplete="off"
                />
              </div>
              <div className="flex-[2]">
                <Label htmlFor="newName">Naziv</Label>
                <Input
                  id="newName"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Naziv grupe"
                  autoComplete="off"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !newCode.trim() || !newName.trim()}
              >
                <Plus className="w-4 h-4 mr-1" />
                Dodaj
              </Button>
            </div>

            {/* Groups table */}
            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Šifra</TableHead>
                    <TableHead>Naziv</TableHead>
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
                  ) : groups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Nema definisanih grupa
                      </TableCell>
                    </TableRow>
                  ) : (
                    groups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="font-mono">
                          <InlineEditCell
                            value={group.code}
                            onSave={async (val) => {
                              await updateGroup({ id: group.id, updates: { code: val } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <InlineEditCell
                            value={group.name}
                            onSave={async (val) => {
                              await updateGroup({ id: group.id, updates: { name: val } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmId(group.id)}
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
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje grupe</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete ovu grupu? Partneri koji pripadaju ovoj grupi će ostati bez grupe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
