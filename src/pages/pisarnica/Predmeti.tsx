import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Briefcase, Trash2, Settings2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmCases, CRM_STATUS_MAP, CRM_STATUS_VARIANTS, CRM_STATUSES } from "@/hooks/useCrmCases";
import { useCrmTypes } from "@/hooks/useCrmTypes";
import { usePartners } from "@/hooks/usePartners";
import { useCompanyUsers } from "@/hooks/useIncomingMail";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CrmTypesDialog } from "@/components/pisarnica/CrmTypesDialog";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";

export default function Predmeti() {
  const navigate = useNavigate();
  const { user, selectedCompany } = useAuth();
  const [statusFilter, setStatusFilter] = useState("__active__");
  const [filterText, setFilterText] = useState("");
  const [typeFilter, setTypeFilter] = useState("__all__");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [typesOpen, setTypesOpen] = useState(false);

  const { cases, isLoading, createCase, deleteCase } = useCrmCases(
    statusFilter === "__active__" ? "__all__" : statusFilter
  );
  const { types } = useCrmTypes();
  const { partners } = usePartners();

  const { data: companyUsers = [] } = useCompanyUsers();
  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    companyUsers.forEach((u) => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
      m.set(u.id, name || u.email || "");
    });
    return m;
  }, [companyUsers]);

  const typeMap = new Map(types.map((t) => [t.id, t]));
  const partnerMap = new Map(partners.map((p) => [p.id, p]));

  let filtered = cases;
  if (statusFilter === "__active__") {
    filtered = filtered.filter((c) => c.status !== "closed");
  }
  if (typeFilter !== "__all__") {
    filtered = filtered.filter((c) => c.crm_type_id === typeFilter);
  }
  if (filterText) {
    const q = filterText.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.case_number.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        (partnerMap.get(c.partner_id || "")?.name || "").toLowerCase().includes(q)
    );
  }

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort("created_at", "desc");

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  const statusOrder: Record<string, number> = { draft: 0, assigned: 1, in_progress: 2, closed: 3 };

  const sorted = sortItems(filtered, (c, col) => {
    switch (col) {
      case "case_number": return c.case_number;
      case "type": return typeMap.get(c.crm_type_id)?.code || "";
      case "subject": return c.subject;
      case "partner": return partnerMap.get(c.partner_id || "")?.name || "";
      case "assigned": return c.assigned_to ? (userMap.get(c.assigned_to) || "") : "";
      case "assigned_at": return c.assigned_at || "";
      case "priority": return priorityOrder[c.priority] ?? 99;
      case "status": return statusOrder[c.status] ?? 99;
      case "deadline": return c.deadline || "";
      case "created_at": return c.created_at;
      default: return "";
    }
  });

  const handleCreate = async () => {
    if (!user?.id || types.length === 0) return;
    const result = await createCase.mutateAsync({
      crm_type_id: types[0].id,
      subject: "Novi predmet",
      owner_user_id: user.id,
      created_by: user.id,
    });
    navigate(`/pisarnica/predmeti/${result.id}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCase.mutateAsync(deleteId);
    setDeleteId(null);
  };

  return (
    <MainLayout title="Predmeti (CRM)">
      <div className="flex flex-col h-full gap-4">
        <div className="erp-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleCreate} disabled={types.length === 0}>
              <Plus className="h-4 w-4 mr-1" /> Novi predmet
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTypesOpen(true)}>
              <Settings2 className="h-4 w-4 mr-1" /> Vrste CRM-a
            </Button>
            <div className="flex-1" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Vrsta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Sve vrste</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__active__">Aktivni</SelectItem>
                <SelectItem value="__all__">Svi</SelectItem>
                {CRM_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Pretraga..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-[200px]"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="erp-card p-8 text-center text-muted-foreground">Učitavanje...</div>
        ) : filtered.length === 0 ? (
          <div className="erp-card p-8 text-center text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nema predmeta za izabrane parametre</p>
            {types.length === 0 && (
              <p className="text-sm mt-2">Najpre kreirajte vrste CRM-a klikom na "Vrste CRM-a"</p>
            )}
          </div>
        ) : (
          <TableScrollContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]"><SortableHeader column="case_number" label="Broj" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[100px]"><SortableHeader column="type" label="Vrsta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[250px] max-w-[250px]"><SortableHeader column="subject" label="Predmet" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortableHeader column="partner" label="Partner" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[150px]"><SortableHeader column="assigned" label="Zadužen" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[110px]"><SortableHeader column="assigned_at" label="Datum dodele" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[100px]"><SortableHeader column="priority" label="Prioritet" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[100px]"><SortableHeader column="status" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[110px]"><SortableHeader column="deadline" label="Rok" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[110px]"><SortableHeader column="created_at" label="Kreiran" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/pisarnica/predmeti/${c.id}`)}
                  >
                    <TableCell className="font-mono text-sm">{c.case_number}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeMap.get(c.crm_type_id)?.code || "?"}</Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-[250px] truncate">{c.subject}</TableCell>
                    <TableCell>{partnerMap.get(c.partner_id || "")?.name || ""}</TableCell>
                    <TableCell className="text-sm">{c.assigned_to ? (userMap.get(c.assigned_to) || "-") : "-"}</TableCell>
                    <TableCell className="text-sm">{c.assigned_at ? format(new Date(c.assigned_at), "dd.MM.yyyy") : ""}</TableCell>
                    <TableCell>
                      <Badge variant={c.priority === "urgent" ? "destructive" : c.priority === "high" ? "default" : "secondary"}>
                        {c.priority === "low" ? "Nizak" : c.priority === "high" ? "Visok" : c.priority === "urgent" ? "Hitan" : "Normalan"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={CRM_STATUS_VARIANTS[c.status] || "secondary"}>
                        {CRM_STATUS_MAP[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.deadline ? format(new Date(c.deadline), "dd.MM.yyyy") : ""}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(c.created_at), "dd.MM.yyyy")}
                    </TableCell>
                    <TableCell>
                      {c.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScrollContainer>
        )}
      </div>

      <CrmTypesDialog open={typesOpen} onOpenChange={setTypesOpen} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje predmeta</AlertDialogTitle>
            <AlertDialogDescription>Da li ste sigurni da želite da obrišete ovaj predmet?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Obriši</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
