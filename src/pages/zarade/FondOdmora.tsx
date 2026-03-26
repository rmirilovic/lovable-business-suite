import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Save } from "lucide-react";
import { useEmployees } from "@/hooks/useEmployees";
import { useAbsences, ABSENCE_TYPE_LABELS } from "@/hooks/useAbsences";
import { useLeaveFunds, useUpsertLeaveFund } from "@/hooks/useLeaveFunds";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function FondOdmora() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState("");
  const { data: employees } = useEmployees();
  const { data: absences } = useAbsences();
  const { data: funds } = useLeaveFunds(year);
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canWrite = hasAccess("zarade.fond_odmora", "write");
  const upsertFund = useUpsertLeaveFund();
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();

  const [editedFunds, setEditedFunds] = useState<Record<string, number>>({});

  const activeEmployees = useMemo(
    () => (employees || []).filter((e) => e.status === "active").sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [employees]
  );

  // Build fund map: employee_id -> total_days
  const fundMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of funds || []) {
      m.set(f.employee_id, f.total_days);
    }
    return m;
  }, [funds]);

  // Build used days map: employee_id -> { type: days }
  const usedMap = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const a of absences || []) {
      const aYear = new Date(a.start_date).getFullYear();
      if (aYear !== year) continue;
      if (!m.has(a.employee_id)) {
        m.set(a.employee_id, { godisnji_odmor: 0, bolovanje: 0, placeno_odsustvo: 0, neplaceno_odsustvo: 0 });
      }
      const rec = m.get(a.employee_id)!;
      rec[a.absence_type] = (rec[a.absence_type] || 0) + a.work_days;
    }
    return m;
  }, [absences, year]);

  const filtered = useMemo(() => {
    return activeEmployees.filter((e) => {
      if (!search) return true;
      const name = `${e.last_name} ${e.first_name}`.toLowerCase();
      return name.includes(search.toLowerCase()) || e.employee_number.toLowerCase().includes(search.toLowerCase());
    });
  }, [activeEmployees, search]);

  const sorted = useMemo(() => {
    return sortItems(filtered, (item, col) => {
      switch (col) {
        case "name": return `${item.last_name} ${item.first_name}`;
        case "number": return item.employee_number;
        case "fund": return editedFunds[item.id] ?? fundMap.get(item.id) ?? item.leave_days_default ?? 20;
        case "used_go": return usedMap.get(item.id)?.godisnji_odmor ?? 0;
        case "remaining": {
          const total = editedFunds[item.id] ?? fundMap.get(item.id) ?? item.leave_days_default ?? 20;
          const used = usedMap.get(item.id)?.godisnji_odmor ?? 0;
          return total - used;
        }
        default: return "";
      }
    });
  }, [filtered, sortItems, fundMap, usedMap, editedFunds]);

  const handleFundChange = (empId: string, value: string) => {
    setEditedFunds((prev) => ({ ...prev, [empId]: parseInt(value) || 0 }));
  };

  const handleSaveAll = async () => {
    if (!selectedCompany?.id) return;
    const entries = Object.entries(editedFunds);
    if (entries.length === 0) {
      toast.info("Nema izmena za čuvanje");
      return;
    }
    try {
      for (const [empId, days] of entries) {
        await upsertFund.mutateAsync({
          company_id: selectedCompany.id,
          employee_id: empId,
          year,
          total_days: days,
        });
      }
      setEditedFunds({});
    } catch {
      // handled in mutation
    }
  };

  return (
    <MainLayout title="Fond godišnjeg odmora">
      <div className="flex flex-col gap-4 h-full">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pretraga..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => { setYear(year - 1); setEditedFunds({}); }}>←</Button>
              <span className="font-medium min-w-[60px] text-center">{year}</span>
              <Button variant="outline" size="sm" onClick={() => { setYear(year + 1); setEditedFunds({}); }}>→</Button>
            </div>
          </div>
          {canWrite && Object.keys(editedFunds).length > 0 && (
            <Button onClick={handleSaveAll} size="sm" disabled={upsertFund.isPending}>
              <Save className="w-4 h-4 mr-2" /> Sačuvaj izmene ({Object.keys(editedFunds).length})
            </Button>
          )}
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  <SortableHeader column="number" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[200px]">
                  <SortableHeader column="name" label="Zaposleni" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px] text-right">
                  <SortableHeader column="fund" label="Fond (dana)" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px] text-right">
                  <SortableHeader column="used_go" label="Iskorišćeno" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px] text-right">
                  <SortableHeader column="remaining" label="Preostalo" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[90px] text-right">Bolovanje</TableHead>
                <TableHead className="w-[90px] text-right">Plaćeno</TableHead>
                <TableHead className="w-[90px] text-right">Neplaćeno</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Nema podataka</TableCell>
                </TableRow>
              ) : (
                sorted.map((emp) => {
                  const totalDays = editedFunds[emp.id] ?? fundMap.get(emp.id) ?? (emp as any).leave_days_default ?? 20;
                  const used = usedMap.get(emp.id) || { godisnji_odmor: 0, bolovanje: 0, placeno_odsustvo: 0, neplaceno_odsustvo: 0 };
                  const remaining = totalDays - (used.godisnji_odmor || 0);
                  return (
                    <TableRow key={emp.id}>
                      <TableCell>{emp.employee_number}</TableCell>
                      <TableCell className="font-medium">{emp.last_name} {emp.first_name}</TableCell>
                      <TableCell className="text-right">
                        {canWrite ? (
                          <LocaleNumberInput
                            value={String(totalDays)}
                            onChange={(v) => handleFundChange(emp.id, v)}
                            decimalPlaces={0}
                            className="w-[70px] text-right ml-auto"
                          />
                        ) : (
                          totalDays
                        )}
                      </TableCell>
                      <TableCell className="text-right">{used.godisnji_odmor || 0}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={remaining < 0 ? "destructive" : remaining <= 5 ? "secondary" : "outline"}>
                          {remaining}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{used.bolovanje || 0}</TableCell>
                      <TableCell className="text-right">{used.placeno_odsustvo || 0}</TableCell>
                      <TableCell className="text-right">{used.neplaceno_odsustvo || 0}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>
    </MainLayout>
  );
}
