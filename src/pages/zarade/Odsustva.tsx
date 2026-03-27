import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Download, FileText, Printer } from "lucide-react";
import { useAbsences, ABSENCE_TYPE_LABELS, ABSENCE_TYPE_COLORS } from "@/hooks/useAbsences";
import { useAuth } from "@/contexts/AuthContext";
import { exportAbsencesToExcel, exportAbsencesToPdf, printAbsences } from "@/lib/absenceExportUtils";
import { useEmployees } from "@/hooks/useEmployees";
import { usePermissions } from "@/hooks/usePermissions";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { formatDate, formatInteger } from "@/lib/formatting";

export default function Odsustva() {
  const { data: absences, isLoading } = useAbsences();
  const { data: employees } = useEmployees();
  const { hasAccess } = usePermissions();
  const { selectedCompany } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("__all__");
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();
  const canWrite = hasAccess("zarade.odsustva", "write");

  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees || []) {
      m.set(e.id, `${e.last_name} ${e.first_name}`);
    }
    return m;
  }, [employees]);

  const filtered = useMemo(() => {
    if (!absences) return [];
    return absences.filter((a) => {
      const empName = employeeMap.get(a.employee_id) || "";
      const matchesSearch =
        !search ||
        empName.toLowerCase().includes(search.toLowerCase()) ||
        (a.note && a.note.toLowerCase().includes(search.toLowerCase()));
      const matchesType = typeFilter === "__all__" || a.absence_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [absences, search, typeFilter, employeeMap]);

  const sorted = useMemo(() => {
    return sortItems(filtered, (item, col) => {
      switch (col) {
        case "employee": return employeeMap.get(item.employee_id) || "";
        case "type": return ABSENCE_TYPE_LABELS[item.absence_type] || "";
        case "start_date": return item.start_date;
        case "end_date": return item.end_date;
        case "work_days": return item.work_days;
        default: return "";
      }
    });
  }, [filtered, sortItems, employeeMap]);

  return (
    <MainLayout title="Evidencija odsustva">
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
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tip odsustva" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Svi tipovi</SelectItem>
                {Object.entries(ABSENCE_TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!sorted.length} onClick={() => {
              const rows = sorted.map((a) => ({ employeeName: employeeMap.get(a.employee_id) || "—", absenceType: a.absence_type, startDate: a.start_date, endDate: a.end_date, workDays: a.work_days, note: a.note || "" }));
              exportAbsencesToExcel(rows, { companyName: selectedCompany?.name || "" });
            }}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" disabled={!sorted.length} onClick={() => {
              const rows = sorted.map((a) => ({ employeeName: employeeMap.get(a.employee_id) || "—", absenceType: a.absence_type, startDate: a.start_date, endDate: a.end_date, workDays: a.work_days, note: a.note || "" }));
              exportAbsencesToPdf(rows, { companyName: selectedCompany?.name || "" });
            }}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" disabled={!sorted.length} onClick={() => {
              const rows = sorted.map((a) => ({ employeeName: employeeMap.get(a.employee_id) || "—", absenceType: a.absence_type, startDate: a.start_date, endDate: a.end_date, workDays: a.work_days, note: a.note || "" }));
              printAbsences(rows, { companyName: selectedCompany?.name || "" });
            }}>
              <Printer className="h-4 w-4 mr-1" /> Štampa
            </Button>
            {canWrite && (
              <Button onClick={() => navigate("/zarade/odsustva/new")} size="sm">
                <Plus className="w-4 h-4 mr-2" /> Novo odsustvo
              </Button>
            )}
          </div>
        </div>

        <TableScrollContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">
                  <SortableHeader column="employee" label="Zaposleni" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[150px]">
                  <SortableHeader column="type" label="Tip" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[110px]">
                  <SortableHeader column="start_date" label="Od" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[110px]">
                  <SortableHeader column="end_date" label="Do" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[90px] text-right">
                  <SortableHeader column="work_days" label="Radnih dana" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>Napomena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Učitavanje...</TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Nema podataka</TableCell>
                </TableRow>
              ) : (
                sorted.map((a) => (
                  <TableRow
                    key={a.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/zarade/odsustva/${a.id}`)}
                  >
                    <TableCell className="font-medium">{employeeMap.get(a.employee_id) || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ABSENCE_TYPE_COLORS[a.absence_type]}>
                        {ABSENCE_TYPE_LABELS[a.absence_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(a.start_date)}</TableCell>
                    <TableCell>{formatDate(a.end_date)}</TableCell>
                    <TableCell className="text-right">{formatInteger(a.work_days)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{a.note || ""}</TableCell>
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
