import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Wallet } from "lucide-react";
import { usePartnerCard } from "@/hooks/usePartnerCard";
import { formatDate, formatNumber } from "@/lib/formatting";
import { useAuth } from "@/contexts/AuthContext";

interface PartnerCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  partnerName: string;
}

const fmt = (v: number) => formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PartnerCardDialog({ open, onOpenChange, partnerId, partnerName }: PartnerCardDialogProps) {
  const { selectedYear } = useAuth();
  const yearStart = selectedYear ? `${selectedYear.year}-01-01` : null;
  const yearEnd = selectedYear ? `${selectedYear.year}-12-31` : null;

  const [dateFrom, setDateFrom] = useState<string>(yearStart || "");
  const [dateTo, setDateTo] = useState<string>(yearEnd || "");

  const { data, isLoading } = usePartnerCard(
    open ? partnerId : null,
    dateFrom || null,
    dateTo || null
  );

  let runningBalance = data?.openingBalance || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <DialogTitle>Finansijska kartica</DialogTitle>
              <p className="text-sm text-muted-foreground">{partnerName}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Od</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40 h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Do</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40 h-8 text-sm"
            />
          </div>
        </div>

        <Separator />

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Učitavanje...</p>
        ) : !data || data.items.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Nema podataka za prikaz</p>
        ) : (
          <div className="border rounded-md overflow-auto max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Datum</TableHead>
                  <TableHead className="w-[80px]">Br. naloga</TableHead>
                  <TableHead className="w-[80px]">Br. dok.</TableHead>
                  <TableHead className="w-[70px]">Konto</TableHead>
                  <TableHead>Opis</TableHead>
                  <TableHead className="text-right w-[110px]">Duguje</TableHead>
                  <TableHead className="text-right w-[110px]">Potražuje</TableHead>
                  <TableHead className="text-right w-[110px]">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Opening balance row */}
                {data.openingBalance !== 0 && (
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={5} className="text-sm font-medium">
                      Početno stanje
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {data.openingBalance > 0 ? fmt(data.openingBalance) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {data.openingBalance < 0 ? fmt(Math.abs(data.openingBalance)) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {fmt(data.openingBalance)}
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((item) => {
                  runningBalance += item.debit_amount - item.credit_amount;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm">{formatDate(item.entry_date)}</TableCell>
                      <TableCell className="text-sm">{item.entry_number}</TableCell>
                      <TableCell className="text-sm">{item.document_number || "-"}</TableCell>
                      <TableCell className="text-sm font-mono">{item.account_code}</TableCell>
                      <TableCell className="text-sm truncate max-w-[200px]">{item.description || "-"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.debit_amount ? fmt(item.debit_amount) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {item.credit_amount ? fmt(item.credit_amount) : ""}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {fmt(runningBalance)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="font-medium">Ukupno</TableCell>
                  <TableCell className="text-right font-mono font-medium">{fmt(data.totalDebit)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{fmt(data.totalCredit)}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{fmt(data.closingBalance)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Convenience button that opens the partner card dialog */
export function PartnerCardButton({ partnerId, partnerName }: { partnerId: string; partnerName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} title="Finansijska kartica kupca">
        <Wallet className="h-4 w-4 mr-2" />
        Kartica
      </Button>
      {open && (
        <PartnerCardDialog
          open={open}
          onOpenChange={setOpen}
          partnerId={partnerId}
          partnerName={partnerName}
        />
      )}
    </>
  );
}
