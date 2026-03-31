import React, { useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, FileDown } from "lucide-react";
import { useFixedAssets } from "@/hooks/useFixedAssets";
import { useFixedAssetGroups } from "@/hooks/useFixedAssetGroups";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber, formatDate } from "@/lib/formatting";

export default function PopisnaListaOS() {
  const { selectedCompany } = useAuth();
  const { data: assets } = useFixedAssets();
  const { data: groups } = useFixedAssetGroups();
  const tableRef = useRef<HTMLDivElement>(null);

  const sortedAssets = [...(assets || [])].sort((a, b) => {
    const gA = groups?.find((g) => g.id === a.group_id)?.sort_order ?? 999;
    const gB = groups?.find((g) => g.id === b.group_id)?.sort_order ?? 999;
    if (gA !== gB) return gA - gB;
    return a.inventory_number.localeCompare(b.inventory_number);
  });

  const totals = sortedAssets.reduce(
    (acc, a) => ({
      acquisition: acc.acquisition + Number(a.acquisition_value),
      depreciation: acc.depreciation + Number(a.accumulated_depreciation),
      current: acc.current + Number(a.current_value),
    }),
    { acquisition: 0, depreciation: 0, current: 0 }
  );

  const handlePrint = () => {
    const printContent = tableRef.current?.innerHTML || "";
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`
        <html><head><title>Popisna lista OS - ${selectedCompany?.name}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
          h2 { margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
          th { background: #f5f5f5; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
        </style></head><body>
        <h2>Popisna lista osnovnih sredstava</h2>
        <p>${selectedCompany?.name} — ${formatDate(new Date())}</p>
        ${printContent}
        </body></html>
      `);
      win.document.close();
      win.print();
    }
  };

  return (
    <MainLayout title="Popisna lista OS">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Popisna lista OS</h1>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Štampaj
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Popisna lista — {selectedCompany?.name} — {format(new Date(), "dd.MM.yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={tableRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>R.br.</TableHead>
                    <TableHead>Inv. broj</TableHead>
                    <TableHead>Naziv</TableHead>
                    <TableHead>Grupa</TableHead>
                    <TableHead>Lokacija</TableHead>
                    <TableHead>Odg. lice</TableHead>
                    <TableHead className="text-right">Nabavna vred.</TableHead>
                    <TableHead className="text-right">Ispravka vred.</TableHead>
                    <TableHead className="text-right">Sadašnja vred.</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAssets.map((asset, idx) => {
                    const group = groups?.find((g) => g.id === asset.group_id);
                    return (
                      <TableRow key={asset.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-medium">{asset.inventory_number}</TableCell>
                        <TableCell>{asset.name}</TableCell>
                        <TableCell>{group ? `${group.code}` : "-"}</TableCell>
                        <TableCell>{asset.location || "-"}</TableCell>
                        <TableCell>{asset.responsible_person || "-"}</TableCell>
                        <TableCell className="text-right">{formatNumber(asset.acquisition_value)}</TableCell>
                        <TableCell className="text-right">{formatNumber(asset.accumulated_depreciation)}</TableCell>
                        <TableCell className="text-right">{formatNumber(asset.current_value)}</TableCell>
                        <TableCell>{asset.status === "active" ? "Aktivan" : asset.status === "disposed" ? "Rashod" : "Otpisan"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {sortedAssets.length > 0 && (
                    <TableRow className="font-bold border-t-2">
                      <TableCell colSpan={6} className="text-right">Ukupno:</TableCell>
                      <TableCell className="text-right">{formatNumber(totals.acquisition)}</TableCell>
                      <TableCell className="text-right">{formatNumber(totals.depreciation)}</TableCell>
                      <TableCell className="text-right">{formatNumber(totals.current)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
