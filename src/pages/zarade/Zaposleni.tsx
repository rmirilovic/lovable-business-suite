import { useState, useMemo, useEffect } from "react";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Download, FileText, Printer, History, Settings2 } from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { useEmployees, STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, EDUCATION_LEVELS } from "@/hooks/useEmployees";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";
import { exportEmployeesToExcel, exportEmployeesToPdf, printEmployees } from "@/lib/employeeListExportUtils";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { toast } from "sonner";
import { formatDate } from "@/lib/formatting";
import { differenceInMonths } from "date-fns";

interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
  width?: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "employee_number", label: "Šifra", defaultVisible: true, width: "80px" },
  { key: "name", label: "Ime i prezime", defaultVisible: true },
  { key: "jmbg", label: "JMBG", defaultVisible: true },
  { key: "date_of_birth", label: "Datum rođenja", defaultVisible: false, width: "110px" },
  { key: "address", label: "Kontakt adresa", defaultVisible: false },
  { key: "city", label: "PB + Mesto", defaultVisible: false },
  { key: "job_title", label: "Radno mesto", defaultVisible: true },
  { key: "org_unit", label: "Org. jedinica", defaultVisible: false },
  { key: "education_level", label: "Stručna sprema", defaultVisible: false },
  { key: "employment_type", label: "Vrsta ugovora", defaultVisible: true },
  { key: "employment_date", label: "Datum zaposlenja", defaultVisible: true, width: "120px" },
  { key: "contracted_salary", label: "Ugovorena zarada", defaultVisible: false, width: "140px" },
  { key: "bank_account", label: "Tekući račun", defaultVisible: false },
  { key: "work_experience", label: "Radni staž", defaultVisible: false, width: "100px" },
  { key: "status", label: "Status", defaultVisible: true, width: "100px" },
];

const STORAGE_KEY = "zaposleni_visible_columns";

function getStoredColumns(): string[] {
  const defaultCols = ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultCols;
    const parsed = JSON.parse(stored) as string[];
    // Inject any new default-visible columns not in stored set
    const allKeys = new Set(ALL_COLUMNS.map((c) => c.key));
    const valid = parsed.filter((k) => allKeys.has(k));
    for (const col of ALL_COLUMNS) {
      if (col.defaultVisible && !valid.includes(col.key)) {
        valid.push(col.key);
      }
    }
    return valid.length > 0 ? valid : defaultCols;
  } catch {
    return defaultCols;
  }
}

function computeTotalExperience(emp: { work_experience_years: number; work_experience_months: number; employment_date: string | null }): string {
  let totalMonths = (emp.work_experience_years || 0) * 12 + (emp.work_experience_months || 0);
  if (emp.employment_date) {
    const start = new Date(emp.employment_date);
    const now = new Date();
    if (start <= now) {
      totalMonths += differenceInMonths(now, start);
    }
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return `${String(years).padStart(2, "0")}G ${String(months).padStart(2, "0")}M`;
}

export default function Zaposleni() {
  const { data: employees, isLoading } = useEmployees();
  const { hasAccess } = usePermissions();
  const { selectedCompany } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [historyEmployee, setHistoryEmployee] = useState<{ id: string; name: string } | null>(null);
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort();

  const { units: orgUnits } = useOrganizationalUnits(selectedCompany?.id);
  const orgUnitMap = useMemo(() => {
    const map = new Map<string, string>();
    orgUnits?.forEach((u) => map.set(u.id, `${u.code} - ${u.name}`));
    return map;
  }, [orgUnits]);

  const [visibleColumns, setVisibleColumns] = useState<string[]>(getStoredColumns);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

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
      case "date_of_birth": return item.date_of_birth || "";
      case "address": return item.address || "";
      case "city": return `${item.postal_code || ""} ${item.city || ""}`;
      case "job_title": return item.job_title || "";
      case "org_unit": return item.org_unit_id ? (orgUnitMap.get(item.org_unit_id) || "") : "";
      case "education_level": return item.education_level || "";
      case "employment_type": return EMPLOYMENT_TYPE_LABELS[item.employment_type] || item.employment_type;
      case "employment_date": return item.employment_date || "";
      case "contracted_salary": return item.contracted_salary || 0;
      case "bank_account": return item.bank_account || "";
      case "work_experience": return computeTotalExperience(item);
      case "status": return item.status;
      default: return "";
    }
  });

  const exportMeta = { companyName: selectedCompany?.name || "" };
  const exportOpts = {
    visibleColumns: ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key)).map((c) => ({ key: c.key, label: c.label })),
    orgUnitMap,
  };

  const handleExcel = () => {
    exportEmployeesToExcel(sorted, exportMeta, exportOpts);
    toast.success("Excel izvezen");
  };
  const handlePdf = async () => {
    await exportEmployeesToPdf(sorted, exportMeta, exportOpts);
    toast.success("PDF izvezen");
  };
  const handlePrint = async () => {
    await printEmployees(sorted, exportMeta, exportOpts);
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

  const isVisible = (key: string) => visibleColumns.includes(key);
  const colCount = visibleColumns.length + 1; // +1 for history column

  const renderCellValue = (emp: (typeof sorted)[0], key: string) => {
    switch (key) {
      case "employee_number":
        return <span className="font-mono">{emp.employee_number}</span>;
      case "name":
        return <span className="font-medium">{emp.last_name} {emp.middle_name ? `(${emp.middle_name}) ` : ""}{emp.first_name}</span>;
      case "jmbg":
        return <span className="font-mono">{emp.jmbg || "-"}</span>;
      case "date_of_birth":
        return emp.date_of_birth ? formatDate(emp.date_of_birth) : "-";
      case "address":
        return emp.address || "-";
      case "city":
        return [emp.postal_code, emp.city].filter(Boolean).join(" ") || "-";
      case "job_title":
        return emp.job_title || "-";
      case "org_unit":
        return emp.org_unit_id ? (orgUnitMap.get(emp.org_unit_id) || "-") : "-";
      case "education_level":
        return emp.education_level || "-";
      case "employment_type":
        return EMPLOYMENT_TYPE_LABELS[emp.employment_type] || emp.employment_type;
      case "employment_date":
        return emp.employment_date ? formatDate(emp.employment_date) : "-";
      case "contracted_salary":
        return <span className="text-right tabular-nums">{emp.contracted_salary ? new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(emp.contracted_salary) : "-"}</span>;
      case "bank_account":
        return <span className="font-mono">{emp.bank_account || "-"}</span>;
      case "work_experience":
        return <span className="font-mono">{computeTotalExperience(emp)}</span>;
      case "status":
        return (
          <Badge variant={statusBadgeVariant(emp.status)}>
            {STATUS_LABELS[emp.status] || emp.status}
          </Badge>
        );
      default:
        return "-";
    }
  };

  return (
    <MainLayout title="Zaposleni">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" title="Podesi kolone">
                  <Settings2 className="w-4 h-4 mr-2" /> Kolone
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {ALL_COLUMNS.map((col) => (
                  <DropdownMenuItem key={col.key} onSelect={(e) => e.preventDefault()}>
                    <label className="flex items-center gap-2 cursor-pointer w-full">
                      <Checkbox
                        checked={visibleColumns.includes(col.key)}
                        onCheckedChange={() => toggleColumn(col.key)}
                      />
                      <span className="text-sm">{col.label}</span>
                    </label>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
                {ALL_COLUMNS.filter((c) => isVisible(c.key)).map((col) => (
                  <TableHead key={col.key} style={col.width ? { width: col.width } : undefined}>
                    <SortableHeader
                      column={col.key}
                      label={col.label}
                      sortColumn={sortColumn}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableHead>
                ))}
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                   <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                     Učitavanje...
                   </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
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
                    {ALL_COLUMNS.filter((c) => isVisible(c.key)).map((col) => (
                      <TableCell key={col.key}>{renderCellValue(emp, col.key)}</TableCell>
                    ))}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Istorija izmena"
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistoryEmployee({ id: emp.id, name: `${emp.last_name} ${emp.first_name}` });
                        }}
                      >
                        <History className="w-4 h-4" />
                      </Button>
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

      {historyEmployee && (
        <DocumentHistoryDialog
          open={!!historyEmployee}
          onOpenChange={(open) => { if (!open) setHistoryEmployee(null); }}
          documentId={historyEmployee.id}
          documentName={historyEmployee.name}
          documentType="employee"
          fieldLabels={{
            employee_number: "Šifra",
            first_name: "Ime",
            middle_name: "Srednje slovo",
            last_name: "Prezime",
            jmbg: "JMBG",
            date_of_birth: "Datum rođenja",
            gender: "Pol",
            address: "Adresa",
            city: "Grad",
            postal_code: "Poštanski broj",
            phone: "Telefon",
            email: "Email",
            education_level: "Nivo obrazovanja",
            job_title: "Radno mesto",
            org_unit_id: "Org. jedinica",
            employment_date: "Datum zaposlenja",
            employment_type: "Vrsta ugovora",
            contract_end_date: "Datum isteka ugovora",
            work_experience_years: "Staž (godine)",
            work_experience_months: "Staž (meseci)",
            bank_account: "Tekući račun",
            is_owner: "Vlasnik firme",
            is_disabled: "Invalid",
            work_time_percent: "% radnog vremena",
            status: "Status",
            termination_date: "Datum prestanka",
            note: "Napomena",
            leave_days_default: "Fond GO (podrazumevano)",
          }}
        />
      )}
    </MainLayout>
  );
}
