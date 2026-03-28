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
import { Search, UserPlus, Download, FileText, Printer, History } from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { useEmployees, STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/hooks/useEmployees";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { exportEmployeesToExcel, exportEmployeesToPdf, printEmployees } from "@/lib/employeeListExportUtils";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatting";

export default function Zaposleni() {
  const { data: employees, isLoading } = useEmployees();
  const { hasAccess } = usePermissions();
  const { selectedCompany } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [historyEmployee, setHistoryEmployee] = useState<{ id: string; name: string } | null>(null);
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();

  const canWrite = hasAccess("zarade.zaposleni", "write");

  const filtered = useMemo(() => {
    if (!employees) return [];
    return employees.filter((e) => {
      const matchesSearch =
        !search ||
        e.employee_number.toLowerCase().includes(search.toLowerCase()) ||
        e.first_name.toLowerCase().includes(search.toLowerCase()) ||
        e.last_name.toLowerCase().includes(search.toLowerCase()) ||
        (e.jmbg && e.jmbg.includes(search)) ||
        (e.job_title && e.job_title.toLowerCase().includes(search.toLowerCase()));

      const matchesStatus = statusFilter === "__all__" || e.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [employees, search, statusFilter]);

  const sorted = sortItems(filtered, (item, column) => {
    switch (column) {
      case "employee_number": return item.employee_number;
      case "name": return `${item.last_name} ${item.middle_name || ""} ${item.first_name}`;
      case "jmbg": return item.jmbg || "";
      case "job_title": return item.job_title || "";
      case "employment_type": return EMPLOYMENT_TYPE_LABELS[item.employment_type] || item.employment_type;
      case "employment_date": return item.employment_date || "";
      case "status": return item.status;
      default: return "";
    }
  });

  const exportMeta = { companyName: selectedCompany?.name || "" };

  const handleExcel = () => {
    exportEmployeesToExcel(sorted, exportMeta);
    toast.success("Excel izvezen");
  };
  const handlePdf = async () => {
    await exportEmployeesToPdf(sorted, exportMeta);
    toast.success("PDF izvezen");
  };
  const handlePrint = async () => {
    await printEmployees(sorted, exportMeta);
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "active": return "default" as const;
      case "terminated": return "destructive" as const;
      case "suspended": return "secondary" as const;
      case "maternity": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <MainLayout title="Zaposleni">
      <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po šifri, imenu, JMBG, radnom mestu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Svi statusi</SelectItem>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExcel} title="Izvezi u Excel">
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePdf} title="Izvezi u PDF">
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} title="Štampaj">
              <Printer className="w-4 h-4 mr-2" /> Štampa
            </Button>
            {canWrite && (
              <Button onClick={() => navigate("/zarade/zaposleni/new")}>
                <UserPlus className="w-4 h-4 mr-2" /> Novi zaposleni
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <TableScrollContainer className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">
                  <SortableHeader column="employee_number" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="name" label="Ime i prezime" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="jmbg" label="JMBG" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="job_title" label="Radno mesto" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="employment_type" label="Vrsta ugovora" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[120px]">
                  <SortableHeader column="employment_date" label="Datum zaposlenja" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">
                  <SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {employees?.length === 0 ? "Nema unetih zaposlenih" : "Nema rezultata pretrage"}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/zarade/zaposleni/${emp.id}`)}
                  >
                    <TableCell className="font-mono">{emp.employee_number}</TableCell>
                    <TableCell className="font-medium">
                      {emp.last_name} {emp.middle_name ? `(${emp.middle_name}) ` : ""}{emp.first_name}
                    </TableCell>
                    <TableCell className="font-mono">{emp.jmbg || "-"}</TableCell>
                    <TableCell>{emp.job_title || "-"}</TableCell>
                    <TableCell>{EMPLOYMENT_TYPE_LABELS[emp.employment_type] || emp.employment_type}</TableCell>
                    <TableCell>
                      {emp.employment_date ? formatDate(emp.employment_date) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(emp.status)}>
                        {STATUS_LABELS[emp.status] || emp.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>

        <div className="text-sm text-muted-foreground">
          Ukupno: {sorted.length} zaposlenih
        </div>
      </div>
    </MainLayout>
  );
}
