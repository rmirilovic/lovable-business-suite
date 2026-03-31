import React, { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { parseLocaleNumber } from "@/lib/formatting";
import { useFixedAssetGroups, FixedAssetGroup } from "@/hooks/useFixedAssetGroups";
import { useFixedAssets } from "@/hooks/useFixedAssets";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/lib/formatting";

export default function GrupeOS() {
  const { selectedCompany } = useAuth();
  const { data: groups, isLoading, upsertGroup, deleteGroup } = useFixedAssetGroups();
  const { data: assets } = useFixedAssets();

  const [dialog, setDialog] = useState(false);
  const [editGroup, setEditGroup] = useState<Partial<FixedAssetGroup> | null>(null);

  const groupStats = groups?.map((g) => {
    const groupAssets = assets?.filter((a) => a.group_id === g.id) || [];
    return {
      ...g,
      assetCount: groupAssets.length,
      totalAcquisition: groupAssets.reduce((s, a) => s + Number(a.acquisition_value), 0),
      totalDepreciation: groupAssets.reduce((s, a) => s + Number(a.accumulated_depreciation), 0),
      totalCurrent: groupAssets.reduce((s, a) => s + Number(a.current_value), 0),
    };
  });

  const totals = groupStats?.reduce(
    (acc, g) => ({
      count: acc.count + g.assetCount,
      acquisition: acc.acquisition + g.totalAcquisition,
      depreciation: acc.depreciation + g.totalDepreciation,
      current: acc.current + g.totalCurrent,
    }),
    { count: 0, acquisition: 0, depreciation: 0, current: 0 }
  );

  const openEdit = (group?: FixedAssetGroup) => {
    setEditGroup(group || { code: "", name: "", depreciation_rate: 0, account_code: "022", depreciation_expense_account: "540", accumulated_depreciation_account: "029", sort_order: (groups?.length || 0) + 1 });
    setDialog(true);
  };

  const handleSave = async () => {
    if (!editGroup?.code || !editGroup?.name) return;
    await upsertGroup.mutateAsync({ ...editGroup, company_id: selectedCompany!.id } as any);
    setDialog(false);
  };

  const handleSeedStandard = async () => {
    const standard = [
      { code: "I", name: "Građevinski objekti", depreciation_rate: 2.5, sort_order: 1 },
      { code: "II", name: "Oprema i transportna sredstva", depreciation_rate: 10, sort_order: 2 },
      { code: "III", name: "Nematerijalna sredstva", depreciation_rate: 15, sort_order: 3 },
      { code: "IV", name: "Sredstva za istraživanje i razvoj", depreciation_rate: 20, sort_order: 4 },
      { code: "V", name: "Ostala osnovna sredstva", depreciation_rate: 30, sort_order: 5 },
    ];
    for (const g of standard) {
      const exists = groups?.find((eg) => eg.code === g.code);
      if (!exists) {
        await upsertGroup.mutateAsync({
          ...g,
          company_id: selectedCompany!.id,
          account_code: "022",
          depreciation_expense_account: "540",
          accumulated_depreciation_account: "029",
        } as any);
      }
    }
  };

  return (
    <MainLayout title="Amortizacione grupe">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Amortizacione grupe</h1>
          <div className="flex gap-2">
            {!groups?.length && (
              <Button variant="outline" onClick={handleSeedStandard}>
                Učitaj standardne RS grupe
              </Button>
            )}
            <Button onClick={() => openEdit()}>
              <Plus className="w-4 h-4 mr-2" /> Nova grupa
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Šifra</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead className="text-right">Stopa (%)</TableHead>
                  <TableHead className="text-right">Br. sredstava</TableHead>
                  <TableHead className="text-right">Nabavna vred.</TableHead>
                  <TableHead className="text-right">Ispravka vred.</TableHead>
                  <TableHead className="text-right">Sadašnja vred.</TableHead>
                  <TableHead className="text-right">Konto OS</TableHead>
                  <TableHead className="text-right">Konto amor.</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell>
                  </TableRow>
                ) : !groupStats?.length ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nema definisanih grupa</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {groupStats.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.code}</TableCell>
                        <TableCell>{g.name}</TableCell>
                        <TableCell className="text-right">{formatNumber(g.depreciation_rate)}</TableCell>
                        <TableCell className="text-right">{g.assetCount}</TableCell>
                        <TableCell className="text-right">{formatNumber(g.totalAcquisition)}</TableCell>
                        <TableCell className="text-right">{formatNumber(g.totalDepreciation)}</TableCell>
                        <TableCell className="text-right">{formatNumber(g.totalCurrent)}</TableCell>
                        <TableCell className="text-right">{g.account_code}</TableCell>
                        <TableCell className="text-right">{g.depreciation_expense_account}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(g)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteGroup.mutate(g.id)} disabled={g.assetCount > 0}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {totals && (
                      <TableRow className="font-bold border-t-2">
                        <TableCell colSpan={3}>Ukupno</TableCell>
                        <TableCell className="text-right">{totals.count}</TableCell>
                        <TableCell className="text-right">{formatNumber(totals.acquisition)}</TableCell>
                        <TableCell className="text-right">{formatNumber(totals.depreciation)}</TableCell>
                        <TableCell className="text-right">{formatNumber(totals.current)}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editGroup?.id ? "Izmena grupe" : "Nova grupa"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Šifra *</Label>
              <Input value={editGroup?.code || ""} onChange={(e) => setEditGroup({ ...editGroup, code: e.target.value })} />
            </div>
            <div>
              <Label>Naziv *</Label>
              <Input value={editGroup?.name || ""} onChange={(e) => setEditGroup({ ...editGroup, name: e.target.value })} />
            </div>
            <div>
              <Label>Stopa amortizacije (%)</Label>
              <LocaleNumberInput value={String(editGroup?.depreciation_rate ?? 0)} onChange={(v) => setEditGroup({ ...editGroup, depreciation_rate: parseLocaleNumber(v) })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Konto OS</Label>
                <Input value={editGroup?.account_code || ""} onChange={(e) => setEditGroup({ ...editGroup, account_code: e.target.value })} />
              </div>
              <div>
                <Label>Konto troška amor.</Label>
                <Input value={editGroup?.depreciation_expense_account || ""} onChange={(e) => setEditGroup({ ...editGroup, depreciation_expense_account: e.target.value })} />
              </div>
              <div>
                <Label>Konto ispr. vred.</Label>
                <Input value={editGroup?.accumulated_depreciation_account || ""} onChange={(e) => setEditGroup({ ...editGroup, accumulated_depreciation_account: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Otkaži</Button>
            <Button onClick={handleSave} disabled={upsertGroup.isPending}>Sačuvaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
