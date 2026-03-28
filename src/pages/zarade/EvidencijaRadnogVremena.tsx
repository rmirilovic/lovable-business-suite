import { useState, useMemo, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Save, Search } from "lucide-react";
import { useEmployees } from "@/hooks/useEmployees";
import { useWorkHours, useUpsertWorkHours, WorkHour } from "@/hooks/useWorkHours";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { parseLocaleNumber, formatNumber } from "@/lib/formatting";

const MONTH_NAMES = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

interface RowData {
  employee_id: string;
  working_days: number;
  worked_days: number;
  hours_regular: number;
  hours_overtime: number;
  hours_holiday: number;
  hours_night: number;
  note: string;
}

export default function EvidencijaRadnogVremena() {
  const { selectedCompany, selectedYear, user } = useAuth();
  const { hasAccess } = usePermissions();
  const canWrite = hasAccess("zarade.evidencija_sati", "write");

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const yearNum = selectedYear?.year || currentDate.getFullYear();
  const [search, setSearch] = useState("");

  const { data: employees, isLoading: empLoading } = useEmployees();
  const { data: workHours, isLoading: whLoading } = useWorkHours(yearNum, selectedMonth);
  const upsertMutation = useUpsertWorkHours();

  const activeEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter((e) => e.is_active);
  }, [employees]);

  // Build editable rows from employees + existing work_hours
  const [editedRows, setEditedRows] = useState<Record<string, RowData>>({});

  const getRowData = useCallback((empId: string): RowData => {
    if (editedRows[empId]) return editedRows[empId];
    const existing = workHours?.find((wh) => wh.employee_id === empId);
    if (existing) {
      return {
        employee_id: empId,
        working_days: existing.working_days,
        worked_days: existing.worked_days,
        hours_regular: existing.hours_regular,
        hours_overtime: existing.hours_overtime,
        hours_holiday: existing.hours_holiday,
        hours_night: existing.hours_night,
        note: existing.note || "",
      };
    }
    return {
      employee_id: empId,
      working_days: 0,
      worked_days: 0,
      hours_regular: 0,
      hours_overtime: 0,
      hours_holiday: 0,
      hours_night: 0,
      note: "",
    };
  }, [editedRows, workHours]);

  const updateField = (empId: string, field: keyof RowData, value: number | string) => {
    const current = getRowData(empId);
    setEditedRows((prev) => ({
      ...prev,
      [empId]: { ...current, [field]: value },
    }));
  };

  // Reset edits when month/year changes
  const [prevKey, setPrevKey] = useState(`${yearNum}-${selectedMonth}`);
  const currentKey = `${yearNum}-${selectedMonth}`;
  if (currentKey !== prevKey) {
    setEditedRows({});
    setPrevKey(currentKey);
  }

  const filtered = useMemo(() => {
    if (!activeEmployees) return [];
    if (!search) return activeEmployees;
    const s = search.toLowerCase();
    return activeEmployees.filter(
      (e) =>
        e.employee_number.toLowerCase().includes(s) ||
        e.first_name.toLowerCase().includes(s) ||
        e.last_name.toLowerCase().includes(s) ||
        (e.job_title && e.job_title.toLowerCase().includes(s))
    );
  }, [activeEmployees, search]);

  const handleSave = () => {
    if (!selectedCompany?.id || !selectedYear?.id || !user?.id) return;

    // Collect all rows (edited + existing unchanged)
    const rows = filtered.map((emp) => {
      const row = getRowData(emp.id);
      return {
        company_id: selectedCompany.id,
        employee_id: emp.id,
        business_year_id: selectedYear.id,
        year: yearNum,
        month: selectedMonth,
        working_days: row.working_days,
        worked_days: row.worked_days,
        hours_regular: row.hours_regular,
        hours_overtime: row.hours_overtime,
        hours_holiday: row.hours_holiday,
        hours_night: row.hours_night,
        note: row.note || null,
        created_by: user.id,
      };
    });

    // Only save rows that have any data
    const nonEmpty = rows.filter(
      (r) =>
        r.working_days > 0 ||
        r.worked_days > 0 ||
        r.hours_regular > 0 ||
        r.hours_overtime > 0 ||
        r.hours_holiday > 0 ||
        r.hours_night > 0
    );

    if (nonEmpty.length === 0) {
      return;
    }

    upsertMutation.mutate(nonEmpty as any);
  };

  const isLoading = empLoading || whLoading;
  const hasEdits = Object.keys(editedRows).length > 0;

  return (
    <MainLayout title="Evidencija radnog vremena">
      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži zaposlene..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, idx) => (
                <SelectItem key={idx + 1} value={String(idx + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground font-medium">
            Godina: {yearNum}
          </div>
          {canWrite && (
            <Button onClick={handleSave} disabled={upsertMutation.isPending || !hasEdits}>
              <Save className="w-4 h-4 mr-2" />
              {upsertMutation.isPending ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          )}
        </div>

        {/* Table */}
        <TableScrollContainer className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Šifra</TableHead>
                <TableHead className="min-w-[180px]">Zaposleni</TableHead>
                <TableHead className="w-[100px] text-right">Radnih dana</TableHead>
                <TableHead className="w-[100px] text-right">Odrađeno dana</TableHead>
                <TableHead className="w-[110px] text-right">Redovni sati</TableHead>
                <TableHead className="w-[110px] text-right">Prekovremeni</TableHead>
                <TableHead className="w-[110px] text-right">Praznici</TableHead>
                <TableHead className="w-[110px] text-right">Noćni rad</TableHead>
                <TableHead className="w-[110px] text-right">Ukupno sati</TableHead>
                <TableHead className="w-[150px]">Napomena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nema aktivnih zaposlenih
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => {
                  const row = getRowData(emp.id);
                  const totalHours = row.hours_regular + row.hours_overtime + row.hours_holiday + row.hours_night;

                  return (
                    <TableRow key={emp.id}>
                      <TableCell className="font-mono">{emp.employee_number}</TableCell>
                      <TableCell className="font-medium">
                        {emp.last_name} {emp.first_name}
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={row.working_days}
                          onValueChange={(v) => updateField(emp.id, "working_days", v)}
                          decimals={0}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={row.worked_days}
                          onValueChange={(v) => updateField(emp.id, "worked_days", v)}
                          decimals={0}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={row.hours_regular}
                          onValueChange={(v) => updateField(emp.id, "hours_regular", v)}
                          decimals={2}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={row.hours_overtime}
                          onValueChange={(v) => updateField(emp.id, "hours_overtime", v)}
                          decimals={2}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={row.hours_holiday}
                          onValueChange={(v) => updateField(emp.id, "hours_holiday", v)}
                          decimals={2}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={row.hours_night}
                          onValueChange={(v) => updateField(emp.id, "hours_night", v)}
                          decimals={2}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {totalHours.toFixed(2)}
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={row.note}
                          onChange={(e) => updateField(emp.id, "note", e.target.value)}
                          className="h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>

        <div className="text-sm text-muted-foreground">
          Ukupno: {filtered.length} zaposlenih za {MONTH_NAMES[selectedMonth - 1]} {yearNum}
        </div>
      </div>
    </MainLayout>
  );
}
