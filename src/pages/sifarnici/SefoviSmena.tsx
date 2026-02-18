import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Save } from "lucide-react";
import { useShiftManagers, ShiftManager } from "@/hooks/useShiftManagers";

export default function SefoviSmena() {
  const { managers, isLoading, updateManager } = useShiftManagers();
  const [editState, setEditState] = useState<Record<string, { first_name: string; last_name: string }>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (managers.length > 0) {
      const state: Record<string, { first_name: string; last_name: string }> = {};
      managers.forEach((m) => {
        state[m.id] = { first_name: m.first_name, last_name: m.last_name };
      });
      setEditState(state);
      setDirty(new Set());
    }
  }, [managers]);

  const handleChange = (id: string, field: "first_name" | "last_name", value: string) => {
    setEditState((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    setDirty((prev) => new Set(prev).add(id));
  };

  const handleSave = async (id: string) => {
    const vals = editState[id];
    if (!vals) return;
    await updateManager.mutateAsync({ id, first_name: vals.first_name, last_name: vals.last_name });
    setDirty((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSaveAll = async () => {
    for (const id of dirty) {
      const vals = editState[id];
      if (vals) {
        await updateManager.mutateAsync({ id, first_name: vals.first_name, last_name: vals.last_name });
      }
    }
    setDirty(new Set());
  };

  return (
    <MainLayout title="Šefovi smena">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Fiksno 3 zapisa — unesite ime i prezime šefa svake smene.
          </p>
          {dirty.size > 0 && (
            <Button onClick={handleSaveAll} disabled={updateManager.isPending}>
              <Save className="w-4 h-4 mr-2" /> Sačuvaj sve
            </Button>
          )}
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Smena</TableHead>
                <TableHead>Ime</TableHead>
                <TableHead>Prezime</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : (
                managers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-semibold text-center">{m.slot_number}</TableCell>
                    <TableCell>
                      <Input
                        value={editState[m.id]?.first_name ?? ""}
                        onChange={(e) => handleChange(m.id, "first_name", e.target.value)}
                        placeholder="Ime"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={editState[m.id]?.last_name ?? ""}
                        onChange={(e) => handleChange(m.id, "last_name", e.target.value)}
                        placeholder="Prezime"
                        autoComplete="off"
                      />
                    </TableCell>
                    <TableCell>
                      {dirty.has(m.id) && (
                        <Button size="sm" variant="outline" onClick={() => handleSave(m.id)} disabled={updateManager.isPending}>
                          <Save className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
