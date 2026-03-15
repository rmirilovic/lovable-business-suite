import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

interface ExchangeRate {
  currencyCode: string;
  currencyName: string;
  unit: number;
  buyingRate: number | null;
  middleRate: number | null;
  sellingRate: number | null;
  date?: string;
}

export default function KursnaLista() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [listDate, setListDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchRates = async (selectedDate?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nbs-exchange-rates", {
        body: { date: selectedDate || date },
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error || "Greška pri preuzimanju kursne liste");
        return;
      }

      setRates(data.rates || []);
      setListDate(data.listDate || "");
      setFetched(true);

      if ((data.rates || []).length === 0) {
        toast.warning("NBS nije vratio podatke za traženi datum");
      } else {
        toast.success(`Preuzeto ${data.rates.length} valuta`);
      }
    } catch (err) {
      console.error("Error fetching rates:", err);
      toast.error("Greška pri komunikaciji sa serverom");
    } finally {
      setLoading(false);
    }
  };

  const formatRate = (rate: number | null) => {
    if (rate === null || rate === undefined) return "–";
    return rate.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  };

  return (
    <MainLayout title="Kursna lista NBS">
      <div className="flex flex-col gap-4 h-full min-h-0">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Datum:</span>
            <LocaleDateInput value={date} onChange={setDate} className="w-[160px]" />
          </div>
          <Button onClick={() => fetchRates()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Preuzimanje..." : "Preuzmi kurs"}
          </Button>
          {listDate && (
            <span className="text-sm text-muted-foreground ml-auto">
              Kurs za datum: {listDate}
            </span>
          )}
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[100px]">Šifra</TableHead>
                <TableHead>Valuta</TableHead>
                <TableHead className="w-[80px] text-center">Jedinica</TableHead>
                <TableHead className="w-[140px] text-right">Kupovni</TableHead>
                <TableHead className="w-[140px] text-right">Srednji</TableHead>
                <TableHead className="w-[140px] text-right">Prodajni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!fetched ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Kliknite "Preuzmi kurs" za preuzimanje kursne liste NBS-a
                  </TableCell>
                </TableRow>
              ) : loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : rates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nema podataka za traženi datum
                  </TableCell>
                </TableRow>
              ) : (
                rates.map((r, i) => (
                  <TableRow key={`${r.currencyCode}-${i}`}>
                    <TableCell className="font-mono font-medium">{r.currencyCode}</TableCell>
                    <TableCell>{r.currencyName}</TableCell>
                    <TableCell className="text-center">{r.unit}</TableCell>
                    <TableCell className="text-right font-mono">{formatRate(r.buyingRate)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatRate(r.middleRate)}</TableCell>
                    <TableCell className="text-right font-mono">{formatRate(r.sellingRate)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>
    </MainLayout>
  );
}
