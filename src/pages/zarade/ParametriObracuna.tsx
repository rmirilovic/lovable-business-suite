import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { usePayrollParameters, usePayrollParameterMutations, PayrollParameter } from "@/hooks/usePayrollParameters";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { format } from "date-fns";

const defaultForm = {
  valid_from: new Date().toISOString().slice(0, 10),
  valid_to: "",
  income_tax_rate: 10,
  pio_employee_rate: 14,
  pio_employer_rate: 11.5,
  health_employee_rate: 5.15,
  health_employer_rate: 5.15,
  unemployment_rate: 0.75,
  non_taxable_amount: 25000,
  min_base_pio: 40880,
  max_base_pio: 584440,
  min_base_health: 40880,
  is_active: true,
  note: "",
};

export default function ParametriObracuna() {
  const { data: params, isLoading } = usePayrollParameters();
  const { createParameter, updateParameter, deleteParameter } = usePayrollParameterMutations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  const openNew = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (p: PayrollParameter) => {
    setEditingId(p.id);
    setForm({
      valid_from: p.valid_from,
      valid_to: p.valid_to || "",
      income_tax_rate: p.income_tax_rate,
      pio_employee_rate: p.pio_employee_rate,
      pio_employer_rate: p.pio_employer_rate,
      health_employee_rate: p.health_employee_rate,
      health_employer_rate: p.health_employer_rate,
      unemployment_rate: p.unemployment_rate,
      non_taxable_amount: p.non_taxable_amount,
      min_base_pio: p.min_base_pio,
      max_base_pio: p.max_base_pio,
      min_base_health: p.min_base_health,
      is_active: p.is_active,
      note: p.note || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      ...form,
      valid_to: form.valid_to || null,
      note: form.note || null,
    };
    if (editingId) {
      await updateParameter.mutateAsync({ id: editingId, ...payload });
    } else {
      await createParameter.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Da li ste sigurni da želite da obrišete ove parametre?")) {
      await deleteParameter.mutateAsync(id);
    }
  };

  const numField = (label: string, key: keyof typeof form, suffix = "%") => (
    <div className="space-y-1">
      <Label className="text-xs">{label} {suffix && <span className="text-muted-foreground">({suffix})</span>}</Label>
      <Input
        type="number"
        step="0.01"
        value={form[key] as number}
        onChange={(e) => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })}
      />
    </div>
  );

  return (
    <MainLayout>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Parametri obračuna</h1>
            <p className="text-sm text-muted-foreground">Poreske stope i doprinosi po RS propisima</p>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novi parametri</Button>
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Važi od</TableHead>
                <TableHead>Važi do</TableHead>
                <TableHead>Porez</TableHead>
                <TableHead>PIO zap.</TableHead>
                <TableHead>PIO posl.</TableHead>
                <TableHead>Zdrav. zap.</TableHead>
                <TableHead>Zdrav. posl.</TableHead>
                <TableHead>Nezap.</TableHead>
                <TableHead>Neoporezivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell></TableRow>
              ) : !params?.length ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nema parametara. Dodajte nove.</TableCell></TableRow>
              ) : params.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(p)}>
                  <TableCell>{format(new Date(p.valid_from), "dd.MM.yyyy")}</TableCell>
                  <TableCell>{p.valid_to ? format(new Date(p.valid_to), "dd.MM.yyyy") : "—"}</TableCell>
                  <TableCell>{p.income_tax_rate}%</TableCell>
                  <TableCell>{p.pio_employee_rate}%</TableCell>
                  <TableCell>{p.pio_employer_rate}%</TableCell>
                  <TableCell>{p.health_employee_rate}%</TableCell>
                  <TableCell>{p.health_employer_rate}%</TableCell>
                  <TableCell>{p.unemployment_rate}%</TableCell>
                  <TableCell>{p.non_taxable_amount.toLocaleString("sr-RS")} RSD</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>
                      {p.is_active ? "Aktivan" : "Neaktivan"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Izmena parametara" : "Novi parametri obračuna"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Važi od</Label>
                <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Važi do</Label>
                <Input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Porez na dohodak</h3>
              <div className="grid grid-cols-2 gap-4">
                {numField("Stopa poreza", "income_tax_rate")}
                {numField("Neoporezivi iznos", "non_taxable_amount", "RSD")}
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Doprinosi za PIO</h3>
              <div className="grid grid-cols-2 gap-4">
                {numField("Na teret zaposlenog", "pio_employee_rate")}
                {numField("Na teret poslodavca", "pio_employer_rate")}
                {numField("Min. osnovica", "min_base_pio", "RSD")}
                {numField("Max. osnovica", "max_base_pio", "RSD")}
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Doprinosi za zdravstvo</h3>
              <div className="grid grid-cols-2 gap-4">
                {numField("Na teret zaposlenog", "health_employee_rate")}
                {numField("Na teret poslodavca", "health_employer_rate")}
                {numField("Min. osnovica", "min_base_health", "RSD")}
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Doprinos za nezaposlenost</h3>
              <div className="grid grid-cols-1 gap-4">
                {numField("Stopa", "unemployment_rate")}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
              <Label>Aktivni parametri</Label>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Napomena</Label>
              <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Otkaži</Button>
            <Button onClick={handleSave} disabled={createParameter.isPending || updateParameter.isPending}>
              {editingId ? "Sačuvaj" : "Kreiraj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
