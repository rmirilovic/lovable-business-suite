import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { FileDown, Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { usePartners } from "@/hooks/usePartners";
import { usePartnerCard } from "@/hooks/usePartnerCard";
import { useAuth } from "@/contexts/AuthContext";
import { SearchablePartnerSelect } from "@/components/ui/searchable-partner-select";
import { formatDecimal } from "@/lib/formatting";

export default function KarticePartnera() {
  const { selectedYear } = useAuth();
  const { partners } = usePartners();

  const currentYear = selectedYear?.year || new Date().getFullYear();
  const defaultDateFrom = `${currentYear}-01-01`;
  const defaultDateTo = `${currentYear}-12-31`;

  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom);
  const [dateTo, setDateTo] = useState<string>(defaultDateTo);

  const { data, isLoading } = usePartnerCard(
    selectedPartnerId || null,
    dateFrom || null,
    dateTo || null
  );

  const selectedPartner = partners.find((p) => p.id === selectedPartnerId);

  // Calculate running balance
  let runningBalance = data?.openingBalance || 0;

  const handleExportCSV = () => {
    if (!data?.items.length) return;

    const headers = ["Datum", "Br. naloga", "Dokument", "Konto", "Opis", "Duguje", "Potražuje", "Saldo"];
    let balance = data.openingBalance;
    
    const rows = data.items.map((item) => {
      balance += item.debit_amount - item.credit_amount;
      return [
        format(new Date(item.entry_date), "dd.MM.yyyy"),
        item.entry_number,
        item.document_number || "",
        item.account_code,
        item.description || "",
        formatDecimal(item.debit_amount, 2),
        formatDecimal(item.credit_amount, 2),
        formatDecimal(balance, 2),
      ].join(";");
    });

    const csv = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kartica-${selectedPartner?.code || "partner"}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout title="Kartice partnera">
      <div className="space-y-6">
        {/* Filters */}
        <div className="erp-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2 space-y-2">
              <Label>Partner</Label>
              <SearchablePartnerSelect
                partners={partners}
                value={selectedPartnerId}
                onValueChange={(id) => setSelectedPartnerId(id)}
                placeholder="Izaberite partnera..."
              />
            </div>

            <div className="space-y-2">
              <Label>Datum od</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Datum do</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Partner info and export */}
        {selectedPartner && (
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedPartner.code} - {selectedPartner.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                PIB: {selectedPartner.pib || "-"} | MB: {selectedPartner.mb || "-"}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={!data?.items.length}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Izvoz CSV
            </Button>
          </div>
        )}

        {/* Results */}
        {!selectedPartnerId ? (
          <div className="erp-card p-8 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Izaberite partnera da biste videli karticu</p>
          </div>
        ) : isLoading ? (
          <div className="erp-card p-8 text-center text-muted-foreground">
            Učitavanje...
          </div>
        ) : (
          <div className="erp-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Datum</TableHead>
                  <TableHead className="w-[100px]">Br. naloga</TableHead>
                  <TableHead className="w-[120px]">Dokument</TableHead>
                  <TableHead className="w-[80px]">Konto</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead className="text-right w-[120px]">Duguje</TableHead>
                  <TableHead className="text-right w-[120px]">Potražuje</TableHead>
                  <TableHead className="text-right w-[120px]">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening balance row */}
                {data && data.openingBalance !== 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={5} className="font-medium">
                      Početni saldo
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {data.openingBalance > 0 ? formatDecimal(data.openingBalance, 2) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {data.openingBalance < 0 ? formatDecimal(Math.abs(data.openingBalance), 2) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatDecimal(data.openingBalance, 2)}
                    </TableCell>
                  </TableRow>
                )}

                {data?.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nema promena za izabrani period
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.items.map((item) => {
                    runningBalance += item.debit_amount - item.credit_amount;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {format(new Date(item.entry_date), "dd.MM.yyyy")}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.entry_number}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.document_number || "-"}
                        </TableCell>
                        <TableCell className="font-mono">{item.account_code}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {item.description || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.debit_amount > 0 ? formatDecimal(item.debit_amount, 2) : ""}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {item.credit_amount > 0 ? formatDecimal(item.credit_amount, 2) : ""}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono font-medium",
                            runningBalance < 0 && "text-destructive"
                          )}
                        >
                          {formatDecimal(runningBalance, 2)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {data && data.items.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="font-semibold">
                      Ukupno za period
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatDecimal(data.totalDebit, 2)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatDecimal(data.totalCredit, 2)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono font-semibold",
                        data.closingBalance < 0 && "text-destructive"
                      )}
                    >
                      {formatDecimal(data.closingBalance, 2)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
