import { useState, useMemo, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Users,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePartners, usePartnerGroups, LEGAL_STATUS_LABELS, Partner } from "@/hooks/usePartners";
import { PartnerDetailsDialog } from "@/components/partneri/PartnerDetailsDialog";
import { PartnerGroupsDialog } from "@/components/partneri/PartnerGroupsDialog";
import { PartnerImportDialog } from "@/components/partneri/PartnerImportDialog";
import { InlineEditCell } from "@/components/sifarnici/InlineEditCell";
import { InlineSelectCell } from "@/components/sifarnici/InlineSelectCell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";

type TypeFilter = "all" | "customer" | "supplier";
type StatusFilter = "all" | "active" | "inactive";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function Partneri() {
  const { partners, isLoading, updatePartner, deletePartner } = usePartners();
  const { groups } = usePartnerGroups();
  const { selectedCompany } = useAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [pibFilter, setPibFilter] = useState<string>("");
  const [mbFilter, setMbFilter] = useState<string>("");

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsMode, setDetailsMode] = useState<"create" | "edit">("create");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [goToPageInput, setGoToPageInput] = useState("");

  // Persist itemsPerPage in localStorage per company
  const storageKey = selectedCompany ? `partners_itemsPerPage_${selectedCompany.id}` : null;

  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (ITEMS_PER_PAGE_OPTIONS.includes(parsed)) {
          setItemsPerPage(parsed);
        }
      }
    }
  }, [storageKey]);

  const handleItemsPerPageChange = (value: string) => {
    const newValue = parseInt(value, 10);
    setItemsPerPage(newValue);
    setCurrentPage(1);
    if (storageKey) {
      localStorage.setItem(storageKey, value);
    }
  };

  // Get unique cities for filter dropdown
  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    partners.forEach((p) => {
      if (p.city) cities.add(p.city);
    });
    return Array.from(cities).sort();
  }, [partners]);

  const filteredPartners = useMemo(() => {
    return partners.filter((partner) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        partner.name.toLowerCase().includes(searchLower) ||
        partner.code.toLowerCase().includes(searchLower) ||
        partner.pib?.includes(searchTerm) ||
        partner.mb?.includes(searchTerm);

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "customer" && partner.is_customer) ||
        (typeFilter === "supplier" && partner.is_supplier);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && partner.is_active) ||
        (statusFilter === "inactive" && !partner.is_active);

      const matchesGroup =
        groupFilter === "all" ||
        (groupFilter === "none" && !partner.group_id) ||
        partner.group_id === groupFilter;

      const matchesCity =
        cityFilter === "all" || partner.city === cityFilter;

      const matchesPib =
        !pibFilter || (partner.pib && partner.pib.includes(pibFilter));

      const matchesMb =
        !mbFilter || (partner.mb && partner.mb.includes(mbFilter));

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesGroup &&
        matchesCity &&
        matchesPib &&
        matchesMb
      );
    });
  }, [partners, searchTerm, typeFilter, statusFilter, groupFilter, cityFilter, pibFilter, mbFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter, groupFilter, cityFilter, pibFilter, mbFilter]);

  // Pagination calculations
  const totalItems = filteredPartners.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedPartners = filteredPartners.slice(startIndex, endIndex);

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleGoToPage = () => {
    const page = parseInt(goToPageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setGoToPageInput("");
    }
  };

  const handleCreate = () => {
    setSelectedPartner(null);
    setDetailsMode("create");
    setDetailsDialogOpen(true);
  };

  const handleEdit = (partner: Partner) => {
    setSelectedPartner(partner);
    setDetailsMode("edit");
    setDetailsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deletePartner(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
    setStatusFilter("active");
    setGroupFilter("all");
    setCityFilter("all");
    setPibFilter("");
    setMbFilter("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm ||
    typeFilter !== "all" ||
    statusFilter !== "active" ||
    groupFilter !== "all" ||
    cityFilter !== "all" ||
    pibFilter ||
    mbFilter;

  const legalStatusOptions = Object.entries(LEGAL_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const groupOptions = [
    { value: "none", label: "Bez grupe" },
    ...groups.map((g) => ({ value: g.id, label: `${g.code} - ${g.name}` })),
  ];

  return (
    <MainLayout title="Šifarnik partnera">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background pb-4">
        <div className="erp-card p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Search and Filters */}
            <div className="flex flex-wrap gap-3 flex-1">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Pretraži..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <Select
                value={typeFilter}
                onValueChange={(val) => setTypeFilter(val as TypeFilter)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tip" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi tipovi</SelectItem>
                  <SelectItem value="customer">Kupci</SelectItem>
                  <SelectItem value="supplier">Dobavljači</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val as StatusFilter)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi statusi</SelectItem>
                  <SelectItem value="active">Aktivni</SelectItem>
                  <SelectItem value="inactive">Neaktivni</SelectItem>
                </SelectContent>
              </Select>

              <Select value={groupFilter} onValueChange={setGroupFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Grupa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve grupe</SelectItem>
                  <SelectItem value="none">Bez grupe</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.code} - {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Mesto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sva mesta</SelectItem>
                  {uniqueCities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="PIB..."
                className="w-[120px]"
                value={pibFilter}
                onChange={(e) => setPibFilter(e.target.value)}
                autoComplete="off"
              />

              <Input
                placeholder="Mat. broj..."
                className="w-[120px]"
                value={mbFilter}
                onChange={(e) => setMbFilter(e.target.value)}
                autoComplete="off"
              />


              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={resetFilters}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Uvoz
              </Button>
              <Button variant="outline" onClick={() => setGroupsDialogOpen(true)}>
                <Users className="w-4 h-4 mr-2" />
                Grupe
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Novi partner
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Partners Table */}
      <div className="erp-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Šifra</TableHead>
                <TableHead>Naziv</TableHead>
                <TableHead className="w-[140px]">Pravni status</TableHead>
                <TableHead>Mesto</TableHead>
                <TableHead>PIB</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead className="w-[100px]">Tip</TableHead>
                <TableHead className="w-[140px]">Grupa</TableHead>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: itemsPerPage }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedPartners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Nema pronađenih partnera
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPartners.map((partner) => (
                  <TableRow
                    key={partner.id}
                    className={!partner.is_active ? "opacity-60" : ""}
                  >
                    <TableCell className="font-mono">{partner.code}</TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={partner.name}
                        onSave={async (val) => {
                          await updatePartner({ id: partner.id, updates: { name: val } });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineSelectCell
                        value={String(partner.legal_status)}
                        options={legalStatusOptions}
                        onSave={async (val) => {
                          await updatePartner({
                            id: partner.id,
                            updates: { legal_status: Number(val) },
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={partner.city || ""}
                        onSave={async (val) => {
                          await updatePartner({ id: partner.id, updates: { city: val } });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={partner.pib || ""}
                        onSave={async (val) => {
                          await updatePartner({ id: partner.id, updates: { pib: val } });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={partner.phone || ""}
                        onSave={async (val) => {
                          await updatePartner({ id: partner.id, updates: { phone: val } });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {partner.is_customer && (
                          <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                            K
                          </Badge>
                        )}
                        {partner.is_supplier && (
                          <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/30">
                            D
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <InlineSelectCell
                        value={partner.group_id || "none"}
                        options={groupOptions}
                        onSave={async (val) => {
                          await updatePartner({
                            id: partner.id,
                            updates: { group_id: val === "none" ? null : val },
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={partner.is_active}
                        onCheckedChange={async (checked) => {
                          await updatePartner({
                            id: partner.id,
                            updates: { is_active: checked },
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(partner)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(partner.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {!isLoading && totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t">
            {/* Items info and per page selector */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Prikazano {startIndex + 1}-{endIndex} od {totalItems}
              </span>
              <div className="flex items-center gap-2">
                <span>Po stranici:</span>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={handleItemsPerPageChange}
                >
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pagination controls */}
            <div className="flex items-center gap-2">
              {/* Go to page */}
              <div className="flex items-center gap-2 mr-4">
                <span className="text-sm text-muted-foreground">Idi na:</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={goToPageInput}
                  onChange={(e) => setGoToPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleGoToPage();
                  }}
                  className="w-16 h-8"
                  placeholder={String(currentPage)}
                  autoComplete="off"
                />
                <span className="text-sm text-muted-foreground">/ {totalPages}</span>
              </div>

              {/* Navigation buttons */}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm px-2">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Partner Details Dialog */}
      <PartnerDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        partner={selectedPartner}
        mode={detailsMode}
      />

      {/* Partner Groups Dialog */}
      <PartnerGroupsDialog open={groupsDialogOpen} onOpenChange={setGroupsDialogOpen} />

      {/* Partner Import Dialog */}
      <PartnerImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Brisanje partnera</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete ovog partnera? Ova akcija je nepovratna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Odustani</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
