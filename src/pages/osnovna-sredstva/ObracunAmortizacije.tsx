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
import { useQueryClient } from "@tanstack/react-query";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";

const months = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"
];

type PeriodMode = "month" | "year";

export default function ObracunAmortizacije() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const { data: assets } = useFixedAssets();
  const { data: groups } = useFixedAssetGroups();
  const queryClient = useQueryClient();

  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth()));
  const [isProcessing, setIsProcessing] = useState(false);

  const year = selectedYear?.year || new Date().getFullYear();

  const activeAssets = assets?.filter((a) => a.status === "active" && a.current_value > a.residual_value) || [];

  /**
   * Calculate prorated depreciation for a specific month.
   * If activation_date is after the period end → 0.
   * If activation_date is within the month → prorate by days.
   * Otherwise → full monthly amount.
   */
  const calcMonthlyDep = (asset: typeof activeAssets[number], monthIndex: number, calcYear: number) => {
    const yearRate = asset.depreciation_rate / 100;
    const fullMonthly = ((asset.acquisition_value - asset.residual_value) * yearRate) / 12;

    const activationDate = asset.activation_date ? new Date(asset.activation_date) : null;
    if (!activationDate) return fullMonthly; // no activation date, assume full

    const periodStart = new Date(calcYear, monthIndex, 1);
    const periodEnd = new Date(calcYear, monthIndex + 1, 0); // last day of month
    const daysInMonth = periodEnd.getDate();

    // Asset not yet activated by end of this month
    if (activationDate > periodEnd) return 0;

    // Asset activated within this month → prorate
    if (activationDate > periodStart) {
      const activeDays = Math.floor((periodEnd.getTime() - activationDate.getTime()) / 86400000) + 1;
      return (fullMonthly * activeDays) / daysInMonth;
    }

    // Activated before this month → full amount
    return fullMonthly;
  };

  const selectedMonthNum = Number(selectedMonth);

  const depreciationItems = activeAssets.map((asset) => {
    const group = groups?.find((g) => g.id === asset.group_id);
    const remaining = asset.current_value - asset.residual_value;

    let totalAmount: number;
    if (periodMode === "year") {
      // Sum prorated amounts for all 12 months, capped at remaining
      let sum = 0;
      let runningRemaining = remaining;
      for (let m = 0; m < 12; m++) {
        const dep = Math.min(calcMonthlyDep(asset, m, year), Math.max(0, runningRemaining));
        sum += dep;
        runningRemaining -= dep;
      }
      totalAmount = sum;
    } else {
      const dep = calcMonthlyDep(asset, selectedMonthNum, year);
      totalAmount = Math.min(dep, Math.max(0, remaining));
    }

    const yearRate = asset.depreciation_rate / 100;
    const fullMonthly = ((asset.acquisition_value - asset.residual_value) * yearRate) / 12;

    return {
      ...asset,
      monthlyAmount: Math.round(fullMonthly * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      groupName: group ? `${group.code} - ${group.name}` : "-",
    };
  });

  const totalDepreciation = depreciationItems.reduce((sum, item) => sum + item.totalAmount, 0);

  const handleCalculate = async () => {
    if (!activeAssets.length) {
      toast.info("Nema sredstava za obračun amortizacije");
      return;
    }
    setIsProcessing(true);
    try {
      if (periodMode === "month") {
        // Single month
        const monthNum = Number(selectedMonth) + 1;
        const changeDate = `${year}-${String(monthNum).padStart(2, "0")}-${new Date(year, monthNum, 0).getDate()}`;
        const changes = depreciationItems
          .filter((item) => item.totalAmount > 0)
          .map((item) => ({
            company_id: selectedCompany!.id,
            fixed_asset_id: item.id,
            change_type: "depreciation" as const,
            change_date: changeDate,
            amount: item.totalAmount,
            description: `Amortizacija za ${months[Number(selectedMonth)]} ${year}`,
            created_by: user!.id,
          }));

        const { error } = await supabase.from("fixed_asset_changes").insert(changes);
        if (error) throw error;

        for (const item of depreciationItems.filter((i) => i.totalAmount > 0)) {
          const newAccum = Number(item.accumulated_depreciation) + item.totalAmount;
          const newCurrent = Number(item.acquisition_value) - newAccum;
          const updates: any = {
            accumulated_depreciation: Math.round(newAccum * 100) / 100,
            current_value: Math.round(Math.max(0, newCurrent) * 100) / 100,
          };
          if (newCurrent <= item.residual_value) updates.status = "fully_depreciated";
          await supabase.from("fixed_assets").update(updates).eq("id", item.id);
        }

        toast.success(`Obračun amortizacije za ${months[Number(selectedMonth)]} ${year} izvršen za ${changes.length} sredstava`);
      } else {
      // Full year – insert one record per asset
        const changeDate = `${year}-12-31`;
        const changes = depreciationItems
          .filter((item) => item.totalAmount > 0)
          .map((item) => ({
            company_id: selectedCompany!.id,
            fixed_asset_id: item.id,
            change_type: "depreciation" as const,
            change_date: changeDate,
            amount: item.totalAmount,
            description: `Amortizacija za godinu ${year}`,
            created_by: user!.id,
          }));

        if (changes.length) {
          const { error } = await supabase.from("fixed_asset_changes").insert(changes);
          if (error) throw error;
        }

        for (const item of depreciationItems.filter((i) => i.totalAmount > 0)) {
          const newAccum = Number(item.accumulated_depreciation) + item.totalAmount;
          const newCurrent = Number(item.acquisition_value) - newAccum;
          const updates: any = {
            accumulated_depreciation: Math.round(newAccum * 100) / 100,
            current_value: Math.round(Math.max(0, newCurrent) * 100) / 100,
          };
          if (newCurrent <= item.residual_value) updates.status = "fully_depreciated";
          await supabase.from("fixed_assets").update(updates).eq("id", item.id);
        }

        toast.success(`Godišnji obračun amortizacije za ${year} izvršen za ${changes.length} sredstava`);
      }

      queryClient.invalidateQueries({ queryKey: ["fixed_assets"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <MainLayout title="Obračun amortizacije">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col min-h-0 flex-1 gap-4">
        <h1 className="text-2xl font-bold text-foreground shrink-0">Obračun amortizacije</h1>

        <Card className="flex flex-col min-h-0 flex-1">
          <CardHeader className="shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <CardTitle>Obračun za {year}. godinu</CardTitle>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label>Period:</Label>
                  <Select value={periodMode} onValueChange={(v) => setPeriodMode(v as PeriodMode)}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Mesečno</SelectItem>
                      <SelectItem value="year">Cela godina</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {periodMode === "month" && (
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
                )}
                <Button onClick={handleCalculate} disabled={isProcessing || !activeAssets.length}>
                  <Calculator className="w-4 h-4 mr-2" />
                  {periodMode === "year" ? "Obračunaj godinu" : "Obračunaj"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col">
            <TableScrollContainer>
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
                    <TableHead className="text-right">
                      {periodMode === "year" ? "Godišnja amort." : "Mesečna amort."}
                    </TableHead>
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
                          <TableCell className="text-right font-medium">{formatNumber(item.totalAmount)}</TableCell>
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
            </TableScrollContainer>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}