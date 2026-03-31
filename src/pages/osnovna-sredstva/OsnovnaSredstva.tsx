import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { useFixedAssets } from "@/hooks/useFixedAssets";
import { formatNumber } from "@/lib/formatting";

const statusLabels: Record<string, string> = {
  active: "Aktivan",
  fully_depreciated: "Otpisan",
  disposed: "Rashod",
  written_off: "Otpisan",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  fully_depreciated: "secondary",
  disposed: "destructive",
  written_off: "destructive",
};

export default function OsnovnaSredstva() {
  const navigate = useNavigate();
  const { data: assets, isLoading } = useFixedAssets();
  const [search, setSearch] = useState("");

  const filtered = assets?.filter((a) =>
    `${a.inventory_number} ${a.name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Osnovna sredstva</h1>
          <Button onClick={() => navigate("/osnovna-sredstva/kartoni/new")}>
            <Plus className="w-4 h-4 mr-2" /> Novo sredstvo
          </Button>
        </div>

        <div className="flex items-center gap-2 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pretraga po broju ili nazivu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inv. broj</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead>Grupa</TableHead>
                <TableHead className="text-right">Nabavna vrednost</TableHead>
                <TableHead className="text-right">Ispravka vred.</TableHead>
                <TableHead className="text-right">Sadašnja vrednost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell>
                </TableRow>
              ) : !filtered?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nema osnovnih sredstava</TableCell>
                </TableRow>
              ) : (
                filtered.map((asset) => (
                  <TableRow
                    key={asset.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/osnovna-sredstva/kartoni/${asset.id}`)}
                  >
                    <TableCell className="font-medium">{asset.inventory_number}</TableCell>
                    <TableCell>{asset.name}</TableCell>
                    <TableCell>{asset.fixed_asset_groups ? `${asset.fixed_asset_groups.code} - ${asset.fixed_asset_groups.name}` : "-"}</TableCell>
                    <TableCell className="text-right">{formatNumber(asset.acquisition_value)}</TableCell>
                    <TableCell className="text-right">{formatNumber(asset.accumulated_depreciation)}</TableCell>
                    <TableCell className="text-right">{formatNumber(asset.current_value)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[asset.status] || "outline"}>
                        {statusLabels[asset.status] || asset.status}
                      </Badge>
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
