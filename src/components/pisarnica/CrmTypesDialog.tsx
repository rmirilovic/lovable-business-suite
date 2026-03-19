import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useCrmTypes } from "@/hooks/useCrmTypes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CrmTypesDialog({ open, onOpenChange }: Props) {
  const { types, createType, updateType, deleteType } = useCrmTypes();
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");

  const handleAdd = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    await createType.mutateAsync({ code: newCode.trim(), name: newName.trim() });
    setNewCode("");
    setNewName("");
  };

  const startEdit = (t: any) => {
    setEditId(t.id);
    setEditCode(t.code);
    setEditName(t.name);
  };

  const saveEdit = async () => {
    if (!editId || !editCode.trim() || !editName.trim()) return;
    await updateType.mutateAsync({ id: editId, code: editCode.trim(), name: editName.trim(), is_active: true });
    setEditId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vrste CRM-a (predmeta)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Šifra</Label>
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="ZP" className="w-20" />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Naziv</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Zahtev za ponudu" />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={createType.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Dodaj
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    {editId === t.id ? (
                      <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} className="h-7 w-16 text-xs" />
                    ) : (
                      <span className="font-mono text-sm">{t.code}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editId === t.id ? (
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-xs" />
                    ) : (
                      t.name
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editId === t.id ? (
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEdit}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(t)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteType.mutate(t.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {types.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                    Nema vrsta. Dodajte prvu vrstu CRM-a.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
