import { useState, useMemo, useEffect, useRef } from "react";
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
  History,
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
import { PartnerHistoryDialog } from "@/components/partneri/PartnerHistoryDialog";
import { PartnerGroupsDialog } from "@/components/partneri/PartnerGroupsDialog";
import { InlineEditCell } from "@/components/sifarnici/InlineEditCell";
import { InlineSelectCell } from "@/components/sifarnici/InlineSelectCell";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { usePermissions } from "@/hooks/usePermissions";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";

type TypeFilter = "all" | "customer" | "supplier";
type StatusFilter = "all" | "active" | "inactive";

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

const PARTNERI_STORAGE_KEY = "partneri_view_state";

function loadPartneriState() {
  try {
    const raw = sessionStorage.getItem(PARTNERI_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export default function Partneri() {
  const { partners, isLoading, updatePartner, deletePartner } = usePartners();
  const { groups } = usePartnerGroups();
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();

  // Check if user has write access to partners module
  const canEdit = hasAccess("sifarnici.partneri", "write");

  const saved = loadPartneriState();

  const [searchTerm, setSearchTerm] = useState(saved.searchTerm ?? "");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(saved.typeFilter ?? "all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(saved.statusFilter ?? "active");
  const [groupFilter, setGroupFilter] = useState<string>(saved.groupFilter ?? "all");
  const [cityFilter, setCityFilter] = useState<string>(saved.cityFilter ?? "all");
  const [pibFilter, setPibFilter] = useState<string>(saved.pibFilter ?? "");
  const [mbFilter, setMbFilter] = useState<string>(saved.mbFilter ?? "");
  const [legalStatusFilter, setLegalStatusFilter] = useState<string>(saved.legalStatusFilter ?? "all");
  const [addressFilter, setAddressFilter] = useState<string>(saved.addressFilter ?? "");
  const [countryFilter, setCountryFilter] = useState<string>(saved.countryFilter ?? "all");
  const [pdvFilter, setPdvFilter] = useState<string>(saved.pdvFilter ?? "all");

  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsMode, setDetailsMode] = useState<"create" | "edit">("create");
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [historyPartner, setHistoryPartner] = useState<Partner | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(saved.currentPage ?? 1);
  const [itemsPerPage, setItemsPerPage] = useState(saved.itemsPerPage ?? 25);
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

  // Get unique countries for filter dropdown
  const uniqueCountries = useMemo(() => {
    const countries = new Set<string>();
    partners.forEach((p) => {
      if (p.country) countries.add(p.country);
    });
    return Array.from(countries).sort();
  }, [partners]);

  // Sorting
  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(
    saved.sortColumn ?? null, saved.sortDirection ?? "asc"
  );

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);

  // Persist view state
  useEffect(() => {
    const scrollTop = tableScrollRef.current?.scrollTop ?? 0;
    sessionStorage.setItem(PARTNERI_STORAGE_KEY, JSON.stringify({
      searchTerm, typeFilter, statusFilter, groupFilter, cityFilter,
      pibFilter, mbFilter, legalStatusFilter, addressFilter, countryFilter, pdvFilter,
      sortColumn, sortDirection, currentPage, itemsPerPage, scrollTop,
    }));
  }, [searchTerm, typeFilter, statusFilter, groupFilter, cityFilter,
      pibFilter, mbFilter, legalStatusFilter, addressFilter, countryFilter, pdvFilter,
      sortColumn, sortDirection, currentPage, itemsPerPage]);

  // Restore scroll
  useEffect(() => {
    if (!isLoading && !restoredScrollRef.current && tableScrollRef.current && saved.scrollTop) {
      restoredScrollRef.current = true;
      requestAnimationFrame(() => {
        if (tableScrollRef.current) tableScrollRef.current.scrollTop = saved.scrollTop;
      });
    }
  }, [isLoading]);

  // Save scroll on scroll
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const h = () => {
      const scrollTop = el.scrollTop;
      try {
        const cur = JSON.parse(sessionStorage.getItem(PARTNERI_STORAGE_KEY) || "{}");
        sessionStorage.setItem(PARTNERI_STORAGE_KEY, JSON.stringify({ ...cur, scrollTop }));
      } catch {}
    };
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, []);

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

      const matchesLegalStatus =
        legalStatusFilter === "all" || String(partner.legal_status) === legalStatusFilter;

      const matchesAddress =
        !addressFilter || (partner.address && partner.address.toLowerCase().includes(addressFilter.toLowerCase()));

      const matchesCountry =
        countryFilter === "all" || 
        (countryFilter === "none" && (!partner.country || partner.country.trim() === "")) ||
        partner.country === countryFilter;

      const matchesPdv =
        pdvFilter === "all" ||
        (pdvFilter === "yes" && partner.is_in_pdv) ||
        (pdvFilter === "no" && !partner.is_in_pdv);

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesGroup &&
        matchesCity &&
        matchesPib &&
        matchesMb &&
        matchesLegalStatus &&
        matchesAddress &&
        matchesCountry &&
        matchesPdv
      );
    });
  }, [partners, searchTerm, typeFilter, statusFilter, groupFilter, cityFilter, pibFilter, mbFilter, legalStatusFilter, addressFilter, countryFilter, pdvFilter]);

  // Sorted partners
  const sortedPartners = useMemo(() => {
    return sortItems(filteredPartners, (item, column) => {
      switch (column) {
        case 'code': return item.code;
        case 'name': return item.name;
        case 'legal_status': return item.legal_status;
        case 'city': return item.city || '';
        case 'pib': return item.pib || '';
        case 'phone': return item.phone || '';
        case 'is_in_pdv': return item.is_in_pdv;
        case 'is_active': return item.is_active;
        default: return null;
      }
    });
  }, [filteredPartners, sortItems]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, statusFilter, groupFilter, cityFilter, pibFilter, mbFilter, legalStatusFilter, addressFilter, countryFilter, pdvFilter]);

  // Pagination calculations
  const totalItems = sortedPartners.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedPartners = sortedPartners.slice(startIndex, endIndex);

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
    setLegalStatusFilter("all");
    setAddressFilter("");
    setCountryFilter("all");
    setPdvFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm ||
    typeFilter !== "all" ||
    statusFilter !== "active" ||
    groupFilter !== "all" ||
    cityFilter !== "all" ||
    pibFilter ||
    mbFilter ||
    legalStatusFilter !== "all" ||
    addressFilter ||
    countryFilter !== "all" ||
    pdvFilter !== "all";

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
      <div className="flex flex-col flex-1 min-h-0">
        {/* Sticky Header */}
        <div className="bg-background pb-4">
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

              <Select value={legalStatusFilter} onValueChange={setLegalStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Pravni status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi statusi</SelectItem>
                  {Object.entries(LEGAL_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Adresa..."
                className="w-[130px]"
                value={addressFilter}
                onChange={(e) => setAddressFilter(e.target.value)}
                autoComplete="off"
              />

              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Država" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Sve države</SelectItem>
                  <SelectItem value="none">Bez države</SelectItem>
                  {uniqueCountries.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={pdvFilter} onValueChange={setPdvFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="PDV" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Svi PDV</SelectItem>
                  <SelectItem value="yes">U PDV-u</SelectItem>
                  <SelectItem value="no">Nije u PDV-u</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={resetFilters}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {canEdit && (
                <Button variant="outline" onClick={() => setGroupsDialogOpen(true)}>
                  <Users className="w-4 h-4 mr-2" />
                  Grupe
                </Button>
              )}
              {canEdit && (
                <Button onClick={handleCreate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novi partner
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Partners Table */}
      <div className="erp-card flex-1 min-h-0 flex flex-col">
        <TableScrollContainer ref={tableScrollRef}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  <SortableHeader column="code" label="Šifra" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="name" label="Naziv" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[140px]">
                  <SortableHeader column="legal_status" label="Pravni status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="city" label="Mesto" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="pib" label="PIB" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead>
                  <SortableHeader column="phone" label="Telefon" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]">Tip</TableHead>
                <TableHead className="w-[70px]">
                  <SortableHeader column="is_in_pdv" label="PDV" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[140px]">Grupa</TableHead>
                <TableHead className="w-[80px]">
                  <SortableHeader column="is_active" label="Status" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                </TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: itemsPerPage }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedPartners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
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
                        disabled={!canEdit}
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
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={partner.city || ""}
                        onSave={async (val) => {
                          await updatePartner({ id: partner.id, updates: { city: val } });
                        }}
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={partner.pib || ""}
                        onSave={async (val) => {
                          await updatePartner({ id: partner.id, updates: { pib: val } });
                        }}
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell>
                      <InlineEditCell
                        value={partner.phone || ""}
                        onSave={async (val) => {
                          await updatePartner({ id: partner.id, updates: { phone: val } });
                        }}
                        disabled={!canEdit}
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
                      <Badge 
                        variant="outline" 
                        className={partner.is_in_pdv 
                          ? "text-xs bg-primary/10 text-primary border-primary/30" 
                          : "text-xs bg-muted text-muted-foreground border-muted-foreground/30"
                        }
                      >
                        {partner.is_in_pdv ? "Da" : "Ne"}
                      </Badge>
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
                        disabled={!canEdit}
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
                        disabled={!canEdit}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Istorija izmena"
                          onClick={() => {
                            setHistoryPartner(partner);
                            setIsHistoryOpen(true);
                          }}
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        {canEdit && (
                          <>
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
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableScrollContainer>

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
      </div>
    </MainLayout>
  );
}
