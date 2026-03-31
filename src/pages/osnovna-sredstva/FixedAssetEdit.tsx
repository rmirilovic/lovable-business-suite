import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { useFixedAsset, useFixedAssets, useFixedAssetChanges } from "@/hooks/useFixedAssets";
import { useFixedAssetGroups } from "@/hooks/useFixedAssetGroups";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber, formatDate, parseLocaleNumber } from "@/lib/formatting";
import { format } from "date-fns";
import { toast } from "sonner";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";

const changeTypeLabels: Record<string, string> = {
  acquisition: "Nabavka",
  depreciation: "Amortizacija",
  write_off: "Otpis",
  disposal: "Rashod",
  revaluation: "Revalorizacija",
  value_adjustment: "Ispravka vrednosti",
  transfer: "Prenos",
};

export default function FixedAssetEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const { selectedCompany, user } = useAuth();
  const { data: asset, isLoading } = useFixedAsset(id);
  const { upsertAsset } = useFixedAssets();
  const { data: groups } = useFixedAssetGroups();
  const { data: changes, addChange, deleteChange } = useFixedAssetChanges(id);

  const [form, setForm] = useState({
    inventory_number: "",
    name: "",
    description: "",
    group_id: "",
    acquisition_date: format(new Date(), "yyyy-MM-dd"),
    activation_date: "",
    acquisition_value: "0",
    residual_value: "0",
    depreciation_rate: "0",
    useful_life_months: "",
    location: "",
    responsible_person: "",
    invoice_reference: "",
    note: "",
    status: "active",
  });

  const [changeDialog, setChangeDialog] = useState(false);
  const [changeForm, setChangeForm] = useState({
    change_type: "depreciation" as string,
    change_date: format(new Date(), "yyyy-MM-dd"),
    amount: "0",
    description: "",
    document_reference: "",
  });

  useEffect(() => {
    if (asset && !isNew) {
      setForm({
        inventory_number: asset.inventory_number,
        name: asset.name,
        description: asset.description || "",
        group_id: asset.group_id || "",
        acquisition_date: asset.acquisition_date,
        activation_date: asset.activation_date || "",
        acquisition_value: String(asset.acquisition_value),
        residual_value: String(asset.residual_value),
        depreciation_rate: String(asset.depreciation_rate),
        useful_life_months: asset.useful_life_months ? String(asset.useful_life_months) : "",
        location: asset.location || "",
        responsible_person: asset.responsible_person || "",
        invoice_reference: asset.invoice_reference || "",
        note: asset.note || "",
        status: asset.status,
      });
    }
  }, [asset, isNew]);

  // Auto-fill depreciation rate from group
  useEffect(() => {
    if (form.group_id && groups) {
      const grp = groups.find((g) => g.id === form.group_id);
      if (grp) {
        setForm((prev) => ({ ...prev, depreciation_rate: String(grp.depreciation_rate) }));
      }
    }
  }, [form.group_id, groups]);

  const handleSave = async () => {
    if (!form.inventory_number || !form.name) {
      toast.error("Inventarni broj i naziv su obavezni");
      return;
    }
    const acqVal = parseLocaleNumber(form.acquisition_value);
    const resVal = parseLocaleNumber(form.residual_value);
    const depRate = parseLocaleNumber(form.depreciation_rate);
    const lifeMonths = form.useful_life_months ? parseInt(form.useful_life_months) : null;
    try {
      const result = await upsertAsset.mutateAsync({
        ...(isNew ? {} : { id }),
        company_id: selectedCompany!.id,
        inventory_number: form.inventory_number,
        name: form.name,
        description: form.description || null,
        group_id: form.group_id || null,
        acquisition_date: form.acquisition_date,
        activation_date: form.activation_date || null,
        acquisition_value: acqVal,
        current_value: isNew ? acqVal : undefined,
        residual_value: resVal,
        depreciation_rate: depRate,
        useful_life_months: lifeMonths,
        location: form.location || null,
        responsible_person: form.responsible_person || null,
        invoice_reference: form.invoice_reference || null,
        note: form.note || null,
        status: form.status,
        created_by: user!.id,
      } as any);
      if (isNew && result?.id) {
        navigate(`/osnovna-sredstva/kartoni/${result.id}`, { replace: true });
      }
    } catch {}
  };

  const handleAddChange = async () => {
    const amountVal = parseLocaleNumber(changeForm.amount);
    if (!amountVal) {
      toast.error("Iznos je obavezan");
    }
    await addChange.mutateAsync({
      company_id: selectedCompany!.id,
      fixed_asset_id: id!,
      change_type: changeForm.change_type,
      change_date: changeForm.change_date,
      amount: amountVal,
      description: changeForm.description || null,
      document_reference: changeForm.document_reference || null,
      created_by: user!.id,
    });
    setChangeDialog(false);
    setChangeForm({
      change_type: "depreciation",
      change_date: format(new Date(), "yyyy-MM-dd"),
      amount: "0",
      description: "",
      document_reference: "",
    });
  };

  if (!isNew && isLoading) {
    return (
      <MainLayout title="Osnovno sredstvo">
        <div className="flex items-center justify-center py-12 text-muted-foreground">Učitavanje...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Karton osnovnog sredstva">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/osnovna-sredstva/kartoni")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">
            {isNew ? "Novo osnovno sredstvo" : `Karton OS: ${form.inventory_number}`}
          </h1>
          <div className="ml-auto flex gap-2">
            <Button onClick={handleSave} disabled={upsertAsset.isPending}>
              <Save className="w-4 h-4 mr-2" /> Sačuvaj
            </Button>
          </div>
        </div>

        {/* Basic info */}
        <Card>
          <CardHeader><CardTitle>Osnovni podaci</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Inventarni broj *</Label>
                <Input value={form.inventory_number} onChange={(e) => setForm({ ...form, inventory_number: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Naziv *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Amortizaciona grupa</Label>
                <Select value={form.group_id} onValueChange={(v) => setForm({ ...form, group_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Izaberite grupu" /></SelectTrigger>
                  <SelectContent>
                    {groups?.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.code} - {g.name} ({g.depreciation_rate}%)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Datum nabavke</Label>
                <LocaleDateInput value={form.acquisition_date} onChange={(v) => setForm({ ...form, acquisition_date: v })} />
              </div>
              <div>
                <Label>Datum aktiviranja</Label>
                <LocaleDateInput value={form.activation_date} onChange={(v) => setForm({ ...form, activation_date: v })} />
              </div>
              <div>
                <Label>Nabavna vrednost</Label>
                <Input type="number" value={form.acquisition_value} onChange={(e) => setForm({ ...form, acquisition_value: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Rezidualna vrednost</Label>
                <Input type="number" value={form.residual_value} onChange={(e) => setForm({ ...form, residual_value: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Stopa amortizacije (%)</Label>
                <Input type="number" value={form.depreciation_rate} onChange={(e) => setForm({ ...form, depreciation_rate: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Vek trajanja (meseci)</Label>
                <Input type="number" value={form.useful_life_months || ""} onChange={(e) => setForm({ ...form, useful_life_months: Number(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Lokacija</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div>
                <Label>Odgovorno lice</Label>
                <Input value={form.responsible_person} onChange={(e) => setForm({ ...form, responsible_person: e.target.value })} />
              </div>
              <div>
                <Label>Referenca fakture</Label>
                <Input value={form.invoice_reference} onChange={(e) => setForm({ ...form, invoice_reference: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktivan</SelectItem>
                    <SelectItem value="fully_depreciated">Potpuno amortizovan</SelectItem>
                    <SelectItem value="disposed">Rashodovan</SelectItem>
                    <SelectItem value="written_off">Otpisan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3">
                <Label>Opis</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="md:col-span-3">
                <Label>Napomena</Label>
                <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current values summary */}
        {!isNew && asset && (
          <Card>
            <CardHeader><CardTitle>Vrednosti</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Nabavna vrednost</p>
                  <p className="text-xl font-bold">{formatNumber(asset.acquisition_value)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Ispravka vrednosti</p>
                  <p className="text-xl font-bold">{formatNumber(asset.accumulated_depreciation)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Sadašnja vrednost</p>
                  <p className="text-xl font-bold">{formatNumber(asset.current_value)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Rezidualna vrednost</p>
                  <p className="text-xl font-bold">{formatNumber(asset.residual_value)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Changes */}
        {!isNew && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Promene</CardTitle>
                <Button size="sm" onClick={() => setChangeDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Nova promena
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Vrsta promene</TableHead>
                    <TableHead className="text-right">Iznos</TableHead>
                    <TableHead>Opis</TableHead>
                    <TableHead>Dokument</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!changes?.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">Nema evidentiranih promena</TableCell>
                    </TableRow>
                  ) : (
                    changes.map((ch) => (
                      <TableRow key={ch.id}>
                        <TableCell>{format(new Date(ch.change_date), "dd.MM.yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{changeTypeLabels[ch.change_type] || ch.change_type}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(ch.amount)}</TableCell>
                        <TableCell>{ch.description || "-"}</TableCell>
                        <TableCell>{ch.document_reference || "-"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteChange.mutate(ch.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Change Dialog */}
      <Dialog open={changeDialog} onOpenChange={setChangeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova promena</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Vrsta promene</Label>
              <Select value={changeForm.change_type} onValueChange={(v) => setChangeForm({ ...changeForm, change_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(changeTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Datum</Label>
              <LocaleDateInput value={changeForm.change_date} onChange={(v) => setChangeForm({ ...changeForm, change_date: v })} />
            </div>
            <div>
              <Label>Iznos</Label>
              <Input type="number" value={changeForm.amount} onChange={(e) => setChangeForm({ ...changeForm, amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Opis</Label>
              <Input value={changeForm.description} onChange={(e) => setChangeForm({ ...changeForm, description: e.target.value })} />
            </div>
            <div>
              <Label>Referenca dokumenta</Label>
              <Input value={changeForm.document_reference} onChange={(e) => setChangeForm({ ...changeForm, document_reference: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangeDialog(false)}>Otkaži</Button>
            <Button onClick={handleAddChange} disabled={addChange.isPending}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
