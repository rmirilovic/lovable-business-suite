import React, { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calculator } from "lucide-react";
import { useFixedAssets } from "@/hooks/useFixedAssets";
import { useFixedAssetGroups } from "@/hooks/useFixedAssetGroups";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/formatting";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

const months = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"
];

export default function ObracunAmortizacije() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const { data: assets } = useFixedAssets();
  const { data: groups } = useFixedAssetGroups();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth()));
  const [isProcessing, setIsProcessing] = useState(false);

  const activeAssets = assets?.filter((a) => a.status === "active" && a.current_value > a.residual_value) || [];

  const depreciationItems = activeAssets.map((asset) => {
    const yearRate = asset.depreciation_rate / 100;
    const monthlyAmount = ((asset.acquisition_value - asset.residual_value) * yearRate) / 12;
    const remaining = asset.current_value - asset.residual_value;
    const actualAmount = Math.min(monthlyAmount, Math.max(0, remaining));
    const group = groups?.find((g) => g.id === asset.group_id);
    return { ...asset, monthlyAmount: actualAmount, groupName: group ? `${group.code} - ${group.name}` : "-" };
  });

  const totalDepreciation = depreciationItems.reduce((sum, item) => sum + item.monthlyAmount, 0);

  const handleCalculate = async () => {
    if (!activeAssets.length) {
      toast.info("Nema sredstava za obračun amortizacije");
      return;
    }
    setIsProcessing(true);
    try {
      const monthNum = Number(selectedMonth) + 1;
      const year = selectedYear?.year || new Date().getFullYear();
      const changeDate = `${year}-${String(monthNum).padStart(2, "0")}-${new Date(year, monthNum, 0).getDate()}`;

      const changes = depreciationItems
        .filter((item) => item.monthlyAmount > 0)
        .map((item) => ({
          company_id: selectedCompany!.id,
          fixed_asset_id: item.id,
          change_type: "depreciation" as const,
          change_date: changeDate,
          amount: Math.round(item.monthlyAmount * 100) / 100,
          description: `Amortizacija za ${months[Number(selectedMonth)]} ${year}`,
          created_by: user!.id,
        }));

      // Insert changes
      const { error: changesError } = await supabase.from("fixed_asset_changes").insert(changes);
      if (changesError) throw changesError;

      // Update each asset
      for (const item of depreciationItems.filter((i) => i.monthlyAmount > 0)) {
        const newAccum = Number(item.accumulated_depreciation) + item.monthlyAmount;
        const newCurrent = Number(item.acquisition_value) - newAccum;
        const updates: any = {
          accumulated_depreciation: Math.round(newAccum * 100) / 100,
          current_value: Math.round(Math.max(0, newCurrent) * 100) / 100,
        };
        if (newCurrent <= item.residual_value) {
          updates.status = "fully_depreciated";
        }
        await supabase.from("fixed_assets").update(updates).eq("id", item.id);
      }

      queryClient.invalidateQueries({ queryKey: ["fixed_assets"] });
      toast.success(`Obračun amortizacije za ${months[Number(selectedMonth)]} izvršen za ${changes.length} sredstava`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Obračun amortizacije</h1>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Mesečni obračun</CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>Mesec:</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {months.map((m, i) => (
                        <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCalculate} disabled={isProcessing || !activeAssets.length}>
                  <Calculator className="w-4 h-4 mr-2" /> Obračunaj
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inv. broj</TableHead>
                  <TableHead>Naziv</TableHead>
                  <TableHead>Grupa</TableHead>
                  <TableHead className="text-right">Nabavna vred.</TableHead>
                  <TableHead className="text-right">Stopa (%)</TableHead>
                  <TableHead className="text-right">Ispravka vred.</TableHead>
                  <TableHead className="text-right">Sadašnja vred.</TableHead>
                  <TableHead className="text-right">Amortizacija</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!depreciationItems.length ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nema aktivnih sredstava za obračun
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {depreciationItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.inventory_number}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.groupName}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.acquisition_value)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.depreciation_rate)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.accumulated_depreciation)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.current_value)}</TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(item.monthlyAmount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={7} className="text-right">Ukupno:</TableCell>
                      <TableCell className="text-right">{formatNumber(totalDepreciation)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
