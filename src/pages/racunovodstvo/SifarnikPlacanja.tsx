import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { usePaymentCodes, usePaymentCodeMutations, PaymentCode } from "@/hooks/usePaymentCodes";
import { cn } from "@/lib/utils";

export default function SifarnikPlacanja() {
  const { data: codes = [], isLoading } = usePaymentCodes();
  const { create, update, remove } = usePaymentCodeMutations();
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ code: "", name: "", account_code: "" });
  const [newRow, setNewRow] = useState(false);
  const [newData, setNewData] = useState({ code: "", name: "", account_code: "" });
  const [filter, setFilter] = useState("");

  const filtered = codes.filter(
    (c) =>
      c.code.toLowerCase().includes(filter.toLowerCase()) ||
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.account_code.toLowerCase().includes(filter.toLowerCase())
  );

  const handleEdit = (pc: PaymentCode) => {
    setEditId(pc.id);
    setEditData({ code: pc.code, name: pc.name, account_code: pc.account_code });
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    await update.mutateAsync({ id: editId, ...editData });
    setEditId(null);
  };

  const handleCreate = async () => {
    if (!newData.code || !newData.name || !newData.account_code) return;
    await create.mutateAsync(newData);
    setNewData({ code: "", name: "", account_code: "" });
    setNewRow(false);
  };

  return (
    <MainLayout title="Šifarnik plaćanja">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Pretraži..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
            autoComplete="off"
          />
          <Button onClick={() => setNewRow(true)} disabled={newRow}>
            <Plus className="w-4 h-4 mr-2" />
            Nova šifra
          </Button>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead className="w-[140px]">Konto</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {newRow && (
                <TableRow className="bg-muted/50">
                  <TableCell>
                    <Input value={newData.code} onChange={(e) => setNewData({ ...newData, code: e.target.value })} placeholder="Šifra" className="h-8" autoComplete="off" />
                  </TableCell>
                  <TableCell>
                    <Input value={newData.name} onChange={(e) => setNewData({ ...newData, name: e.target.value })} placeholder="Naziv" className="h-8" autoComplete="off" />
                  </TableCell>
                  <TableCell>
                    <Input value={newData.account_code} onChange={(e) => setNewData({ ...newData, account_code: e.target.value })} placeholder="Konto" className="h-8 font-mono" autoComplete="off" />
                  </TableCell>
                  <TableCell />
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={handleCreate} disabled={create.isPending}>
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setNewRow(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nema šifara plaćanja</TableCell>
                </TableRow>
              ) : (
                filtered.map((pc) =>
                  editId === pc.id ? (
                    <TableRow key={pc.id} className="bg-muted/50">
                      <TableCell>
                        <Input value={editData.code} onChange={(e) => setEditData({ ...editData, code: e.target.value })} className="h-8" autoComplete="off" />
                      </TableCell>
                      <TableCell>
                        <Input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} className="h-8" autoComplete="off" />
                      </TableCell>
                      <TableCell>
                        <Input value={editData.account_code} onChange={(e) => setEditData({ ...editData, account_code: e.target.value })} className="h-8 font-mono" autoComplete="off" />
                      </TableCell>
                      <TableCell />
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={handleSaveEdit} disabled={update.isPending}>
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditId(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={pc.id}>
                      <TableCell className="font-mono">{pc.code}</TableCell>
                      <TableCell>{pc.name}</TableCell>
                      <TableCell className="font-mono">{pc.account_code}</TableCell>
                      <TableCell>
                        <Badge variant={pc.is_active ? "default" : "secondary"}>
                          {pc.is_active ? "Aktivan" : "Neaktivan"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(pc)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Obrisati?")) remove.mutate(pc.id); }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                )
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
