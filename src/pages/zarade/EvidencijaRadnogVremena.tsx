import { useState, useMemo, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Save, Search } from "lucide-react";
import { useEmployees } from "@/hooks/useEmployees";
import { useWorkHours, useUpsertWorkHours } from "@/hooks/useWorkHours";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { parseLocaleNumber } from "@/lib/formatting";

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

  // Month-level defaults
  const [monthWorkingDays, setMonthWorkingDays] = useState(0);
  const [monthHolidayHours, setMonthHolidayHours] = useState(0);

  const activeEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter((e) => e.is_active);
  }, [employees]);

  // Build editable rows from employees + existing work_hours
  const [editedRows, setEditedRows] = useState<Record<string, RowData>>({});

  // Initialize month-level defaults from existing data
  useEffect(() => {
    if (workHours && workHours.length > 0) {
      // Take working_days and holiday_hours from the first record as month-level default
      const first = workHours[0];
      setMonthWorkingDays(first.working_days);
      setMonthHolidayHours(first.hours_holiday);
    } else {
      setMonthWorkingDays(0);
      setMonthHolidayHours(0);
    }
  }, [workHours]);

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
    // Default for new: use month-level values
    return {
      employee_id: empId,
      working_days: monthWorkingDays,
      worked_days: monthWorkingDays,
      hours_regular: monthWorkingDays * 8,
      hours_overtime: 0,
      hours_holiday: monthHolidayHours,
      hours_night: 0,
      note: "",
    };
  }, [editedRows, workHours, monthWorkingDays, monthHolidayHours]);

  const updateField = (empId: string, field: keyof RowData, value: number | string) => {
    const current = getRowData(empId);
    const updated = { ...current, [field]: value };

    // Auto-cascade: if worked_days changed, recalculate hours_regular
    if (field === "worked_days") {
      updated.hours_regular = (value as number) * 8;
    }

    setEditedRows((prev) => ({
      ...prev,
      [empId]: updated,
    }));
  };

  // When month-level working days changes, apply to all employees that haven't been individually edited
  const handleMonthWorkingDaysChange = (newDays: number) => {
    const oldDays = monthWorkingDays;
    setMonthWorkingDays(newDays);

    // Update all rows where working_days still matches the old month-level value (not individually edited)
    setEditedRows((prev) => {
      const updated = { ...prev };
      activeEmployees.forEach((emp) => {
        const existing = workHours?.find((wh) => wh.employee_id === emp.id);
        const currentRow = prev[emp.id] || (existing ? {
          employee_id: emp.id,
          working_days: existing.working_days,
          worked_days: existing.worked_days,
          hours_regular: existing.hours_regular,
          hours_overtime: existing.hours_overtime,
          hours_holiday: existing.hours_holiday,
          hours_night: existing.hours_night,
          note: existing.note || "",
        } : null);

        // If no individual edit exists, or working_days matches old month value — update
        if (!currentRow || currentRow.working_days === oldDays) {
          updated[emp.id] = {
            employee_id: emp.id,
            working_days: newDays,
            worked_days: newDays,
            hours_regular: newDays * 8,
            hours_overtime: currentRow?.hours_overtime ?? 0,
            hours_holiday: currentRow?.hours_holiday ?? monthHolidayHours,
            hours_night: currentRow?.hours_night ?? 0,
            note: currentRow?.note ?? "",
          };
        }
      });
      return updated;
    });
  };

  // When month-level holiday hours changes, apply to all employees that haven't been individually edited
  const handleMonthHolidayHoursChange = (newHours: number) => {
    const oldHours = monthHolidayHours;
    setMonthHolidayHours(newHours);

    setEditedRows((prev) => {
      const updated = { ...prev };
      activeEmployees.forEach((emp) => {
        const currentRow = prev[emp.id];
        const existing = workHours?.find((wh) => wh.employee_id === emp.id);

        const row = currentRow || (existing ? {
          employee_id: emp.id,
          working_days: existing.working_days,
          worked_days: existing.worked_days,
          hours_regular: existing.hours_regular,
          hours_overtime: existing.hours_overtime,
          hours_holiday: existing.hours_holiday,
          hours_night: existing.hours_night,
          note: existing.note || "",
        } : null);

        if (!row || row.hours_holiday === oldHours) {
          updated[emp.id] = {
            employee_id: emp.id,
            working_days: row?.working_days ?? monthWorkingDays,
            worked_days: row?.worked_days ?? monthWorkingDays,
            hours_regular: row?.hours_regular ?? (monthWorkingDays * 8),
            hours_overtime: row?.hours_overtime ?? 0,
            hours_holiday: newHours,
            hours_night: row?.hours_night ?? 0,
            note: row?.note ?? "",
          };
        }
      });
      return updated;
    });
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

    const nonEmpty = rows.filter(
      (r) =>
        r.working_days > 0 ||
        r.worked_days > 0 ||
        r.hours_regular > 0 ||
        r.hours_overtime > 0 ||
        r.hours_holiday > 0 ||
        r.hours_night > 0
    );

    if (nonEmpty.length === 0) return;

    upsertMutation.mutate(nonEmpty as any);
  };

  const isLoading = empLoading || whLoading;
  const hasEdits = Object.keys(editedRows).length > 0;

  return (
    <MainLayout title="Evidencija radnog vremena">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Month-level defaults */}
        <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Mesec</Label>
            <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-[160px]">
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
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Godina</Label>
            <Input value={yearNum} disabled className="w-[80px] h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Radnih dana u mesecu</Label>
            <LocaleNumberInput
              value={String(monthWorkingDays)}
              onChange={(v) => handleMonthWorkingDaysChange(parseLocaleNumber(v))}
              decimalPlaces={0}
              className="w-[100px] h-9 text-right"
              disabled={!canWrite}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Sati praznika (mesečno)</Label>
            <LocaleNumberInput
              value={String(monthHolidayHours)}
              onChange={(v) => handleMonthHolidayHoursChange(parseLocaleNumber(v))}
              decimalPlaces={2}
              className="w-[100px] h-9 text-right"
              disabled={!canWrite}
            />
          </div>
          <div className="flex-1" />
          {canWrite && (
            <Button onClick={handleSave} disabled={upsertMutation.isPending || !hasEdits}>
              <Save className="w-4 h-4 mr-2" />
              {upsertMutation.isPending ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pretraži zaposlene..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
                          value={String(row.working_days)}
                          onChange={(v) => updateField(emp.id, "working_days", parseLocaleNumber(v))}
                          decimalPlaces={0}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={String(row.worked_days)}
                          onChange={(v) => updateField(emp.id, "worked_days", parseLocaleNumber(v))}
                          decimalPlaces={0}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={String(row.hours_regular)}
                          onChange={(v) => updateField(emp.id, "hours_regular", parseLocaleNumber(v))}
                          decimalPlaces={2}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={String(row.hours_overtime)}
                          onChange={(v) => updateField(emp.id, "hours_overtime", parseLocaleNumber(v))}
                          decimalPlaces={2}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={String(row.hours_holiday)}
                          onChange={(v) => updateField(emp.id, "hours_holiday", parseLocaleNumber(v))}
                          decimalPlaces={2}
                          className="text-right h-8"
                          disabled={!canWrite}
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <LocaleNumberInput
                          value={String(row.hours_night)}
                          onChange={(v) => updateField(emp.id, "hours_night", parseLocaleNumber(v))}
                          decimalPlaces={2}
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
