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
import { Plus, Search, UserPlus } from "lucide-react";
import { useEmployees, STATUS_LABELS, EMPLOYMENT_TYPE_LABELS } from "@/hooks/useEmployees";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/usePermissions";

export default function Zaposleni() {
  const { data: employees, isLoading } = useEmployees();
  const { hasAccess } = usePermissions();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");

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
      <div className="flex flex-col gap-4">
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
          {canWrite && (
            <Button onClick={() => navigate("/zarade/zaposleni/new")}>
              <UserPlus className="w-4 h-4 mr-2" /> Novi zaposleni
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Šifra</TableHead>
                <TableHead>Ime i prezime</TableHead>
                <TableHead>JMBG</TableHead>
                <TableHead>Radno mesto</TableHead>
                <TableHead>Vrsta ugovora</TableHead>
                <TableHead>Datum zaposlenja</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Učitavanje...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {employees?.length === 0 ? "Nema unetih zaposlenih" : "Nema rezultata pretrage"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/zarade/zaposleni/${emp.id}`)}
                  >
                    <TableCell className="font-mono">{emp.employee_number}</TableCell>
                    <TableCell className="font-medium">
                      {emp.last_name} {emp.first_name}
                    </TableCell>
                    <TableCell className="font-mono">{emp.jmbg || "-"}</TableCell>
                    <TableCell>{emp.job_title || "-"}</TableCell>
                    <TableCell>{EMPLOYMENT_TYPE_LABELS[emp.employment_type] || emp.employment_type}</TableCell>
                    <TableCell>
                      {emp.employment_date ? format(new Date(emp.employment_date), "dd.MM.yyyy") : "-"}
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
        </div>

        <div className="text-sm text-muted-foreground">
          Ukupno: {filtered.length} zaposlenih
        </div>
      </div>
    </MainLayout>
  );
}
