import { useState, useMemo, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useBankAccounts, BankAccountInsert } from "@/hooks/useBankAccounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Search, Landmark, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineEditCell } from "@/components/sifarnici/InlineEditCell";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { TableScrollContainer } from "@/components/ui/table-scroll-container";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableHeader } from "@/components/ui/sortable-header";

interface FormData {
  code: string;
  account_number: string;
  bank_name: string;
  currency: string;
  gl_account_code: string;
  is_default: boolean;
}

const emptyForm: FormData = { code: "", account_number: "", bank_name: "", currency: "RSD", gl_account_code: "2410", is_default: false };

const CURRENCY_OPTIONS = ["RSD", "EUR", "USD", "CHF", "GBP"];

export default function TekuciRacuni() {
  const { selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const companyId = selectedCompany?.id;
  const canEdit = hasAccess("sifarnici.magacini", "write"); // reuse magacini permission for now

  const {
    bankAccounts, isLoading, createBankAccount, updateBankAccount, deleteBankAccount,
    isCreating, isUpdating,
  } = useBankAccounts(companyId);

  const VIEW_KEY = "tekuci_racuni_view";
  const saved = (() => { try { const r = sessionStorage.getItem(VIEW_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; } })();

  const [searchTerm, setSearchTerm] = useState(saved.searchTerm ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(saved.statusFilter ?? "active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { sortColumn, sortDirection, handleSort, sortItems } = useTableSort(saved.sortColumn ?? null, saved.sortDirection ?? "asc");

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const restoredScrollRef = useRef(false);

  useEffect(() => {
    sessionStorage.setItem(VIEW_KEY, JSON.stringify({
      searchTerm, statusFilter, sortColumn, sortDirection,
      scrollTop: tableScrollRef.current?.scrollTop ?? 0,
    }));
  }, [searchTerm, statusFilter, sortColumn, sortDirection]);

  useEffect(() => {
    if (!isLoading && !restoredScrollRef.current && tableScrollRef.current && saved.scrollTop) {
      restoredScrollRef.current = true;
      requestAnimationFrame(() => { if (tableScrollRef.current) tableScrollRef.current.scrollTop = saved.scrollTop; });
    }
  }, [isLoading]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const h = () => { try { const c = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "{}"); sessionStorage.setItem(VIEW_KEY, JSON.stringify({ ...c, scrollTop: el.scrollTop })); } catch {} };
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, []);

  const filtered = useMemo(() => {
    return bankAccounts.filter((ba) => {
      const matchesSearch =
        ba.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ba.account_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ba.bank_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && ba.is_active) ||
        (statusFilter === "inactive" && !ba.is_active);
      return matchesSearch && matchesStatus;
    });
  }, [bankAccounts, searchTerm, statusFilter]);

  const sorted = useMemo(() => {
    return sortItems(filtered, (item, column) => {
      switch (column) {
        case "code": return item.code;
        case "account_number": return item.account_number;
        case "bank_name": return item.bank_name;
        case "is_active": return item.is_active;
        case "is_default": return item.is_default;
        default: return null;
      }
    });
  }, [filtered, sortItems]);

  const handleAdd = () => { setForm(emptyForm); setDialogOpen(true); };

  const handleDeleteClick = (id: string) => { setDeletingId(id); setDeleteDialogOpen(true); };

  const handleConfirmDelete = async () => {
    if (deletingId) {
      await deleteBankAccount(deletingId);
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const handleSave = async () => {
    if (!companyId) return;
    if (!form.code.trim() || !form.account_number.trim() || !form.bank_name.trim()) {
      toast.error("Popunite sva obavezna polja");
      return;
    }
    const newBA: BankAccountInsert = {
      company_id: companyId,
      code: form.code.trim(),
      account_number: form.account_number.trim(),
      bank_name: form.bank_name.trim(),
      currency: form.currency,
      gl_account_code: form.gl_account_code.trim() || (form.currency === "RSD" ? "2410" : "242"),
      is_active: true,
      is_default: form.is_default,
    };
    await createBankAccount(newBA);
    setDialogOpen(false);
    setForm(emptyForm);
  };

  const isSaving = isCreating || isUpdating;
  const canSave = form.code.trim() !== "" && form.account_number.trim() !== "" && form.bank_name.trim() !== "";

  return (
    <MainLayout title="Tekući računi">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col flex-1 min-h-0 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-8 w-8" />
              Tekući računi
            </h1>
            <p className="text-muted-foreground">Upravljanje tekućim računima firme</p>
          </div>
          {canEdit && (
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Novi tekući račun
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po šifri, broju računa, banci..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Svi</SelectItem>
              <SelectItem value="active">Aktivni</SelectItem>
              <SelectItem value="inactive">Neaktivni</SelectItem>
            </SelectContent>
          </Select>

          {statusFilter !== "active" && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter("active")}>
              Poništi filtere
            </Button>
          )}
        </div>

        <div className="border rounded-lg flex-1 min-h-0 flex flex-col">
          <TableScrollContainer ref={tableScrollRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">
                    <SortableHeader column="code" label="Šifra TR" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="account_number" label="Broj računa" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead>
                    <SortableHeader column="bank_name" label="Naziv banke" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="w-[100px] text-center">
                    <SortableHeader column="is_default" label="Podraz." sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" />
                  </TableHead>
                  <TableHead className="w-[80px] text-center">
                    <SortableHeader column="is_active" label="Aktivan" sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} className="justify-center" />
                  </TableHead>
                  <TableHead className="w-[80px] text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {searchTerm || statusFilter !== "active" ? "Nema rezultata pretrage" : "Nema tekućih računa. Kliknite 'Novi tekući račun' da dodate."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((ba) => (
                    <TableRow key={ba.id}>
                      <TableCell className="font-medium">
                        <InlineEditCell
                          value={ba.code}
                          onSave={async (val) => {
                            if (val.length > 15) { toast.error("Maksimalno 15 karaktera"); return; }
                            await updateBankAccount({ id: ba.id, updates: { code: val } });
                          }}
                          disabled={!canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={ba.account_number}
                          onSave={async (val) => {
                            if (val.length > 31) { toast.error("Maksimalno 31 karakter"); return; }
                            await updateBankAccount({ id: ba.id, updates: { account_number: val } });
                          }}
                          disabled={!canEdit}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={ba.bank_name}
                          onSave={async (val) => {
                            if (val.length > 63) { toast.error("Maksimalno 63 karaktera"); return; }
                            await updateBankAccount({ id: ba.id, updates: { bank_name: val } });
                          }}
                          disabled={!canEdit}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={ba.is_default ? "text-yellow-500" : "text-muted-foreground/40"}
                            onClick={async () => {
                              await updateBankAccount({ id: ba.id, updates: { is_default: !ba.is_default } });
                            }}
                          >
                            <Star className={`h-4 w-4 ${ba.is_default ? "fill-current" : ""}`} />
                          </Button>
                        ) : (
                          ba.is_default && <Star className="h-4 w-4 text-yellow-500 fill-current mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={ba.is_active}
                          onCheckedChange={async (checked) => {
                            await updateBankAccount({ id: ba.id, updates: { is_active: checked } });
                          }}
                          disabled={!canEdit}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(ba.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableScrollContainer>
        </div>

        {/* Add dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Novi tekući račun</DialogTitle>
              <DialogDescription>Unesite podatke za novi tekući račun</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="code" className="text-right">Šifra TR</Label>
                <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="col-span-3" maxLength={15} placeholder="npr. TR001" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="account_number" className="text-right">Račun</Label>
                <Input id="account_number" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} className="col-span-3" maxLength={31} placeholder="npr. 160-0000000000000-00" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="bank_name" className="text-right">Banka</Label>
                <Input id="bank_name" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} className="col-span-3" maxLength={63} placeholder="npr. Banca Intesa" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Podrazumevani</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Switch checked={form.is_default} onCheckedChange={(checked) => setForm({ ...form, is_default: checked })} />
                  <span className="text-sm text-muted-foreground">{form.is_default ? "Da" : "Ne"}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Otkaži</Button>
              <Button onClick={handleSave} disabled={!canSave || isSaving}>
                {isSaving ? "Čuvanje..." : "Sačuvaj"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Brisanje tekućeg računa</AlertDialogTitle>
              <AlertDialogDescription>Da li ste sigurni? Ova akcija se ne može poništiti.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Otkaži</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete}>Obriši</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
