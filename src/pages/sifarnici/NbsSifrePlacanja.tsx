import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { SortableHeader } from "@/components/ui/sortable-header";
import { useTableSort } from "@/hooks/useTableSort";
import { supabase } from "@/integrations/supabase/client";

interface NbsPaymentCode {
  id: string;
  code: string;
  name: string;
}

export default function NbsSifrePlacanja() {
  const [filter, setFilter] = useState("");

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["nbs_payment_codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nbs_payment_codes")
        .select("id, code, name")
        .order("code");
      if (error) throw error;
      return data as NbsPaymentCode[];
    },
  });

  const filtered = codes.filter(
    (c) =>
      c.code.toLowerCase().includes(filter.toLowerCase()) ||
      c.name.toLowerCase().includes(filter.toLowerCase())
  );

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("code", "asc");
  const sortedData = sortItems(filtered, (item, col) => (item as any)[col]);

  return (
    <MainLayout title="NBS šifarnik plaćanja – bezgotovinska (2xx)">
      <div className="flex flex-col gap-4 h-full min-h-0">
        <div className="flex items-center gap-4">
          <Input
            placeholder="Pretraži po šifri ili opisu..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
            autoComplete="off"
          />
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} od {codes.length} šifara
          </span>
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[120px]">
                  <SortableHeader label="Šifra" column="code" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Opis plaćanja" column="name" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Učitavanje...</TableCell>
                </TableRow>
              ) : sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">Nema rezultata</TableCell>
                </TableRow>
              ) : (
                sortedData.map((pc) => (
                  <TableRow key={pc.id}>
                    <TableCell className="font-mono font-medium">{pc.code}</TableCell>
                    <TableCell>{pc.name}</TableCell>
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
