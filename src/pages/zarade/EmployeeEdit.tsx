import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { ArrowLeft, Save, Trash2, History } from "lucide-react";
import { DocumentHistoryDialog } from "@/components/shared/DocumentHistoryDialog";
import { toast } from "sonner";
import {
  useEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useNextEmployeeNumber,
  EMPLOYMENT_TYPE_LABELS,
  STATUS_LABELS,
  EDUCATION_LEVELS,
} from "@/hooks/useEmployees";
import { useOrganizationalUnits } from "@/hooks/useOrganizationalUnits";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EmployeeForm {
  employee_number: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  jmbg: string;
  date_of_birth: string;
  gender: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  education_level: string;
  job_title: string;
  org_unit_id: string;
  employment_date: string;
  employment_type: string;
  contract_end_date: string;
  work_experience_years: string;
  work_experience_months: string;
  bank_account: string;
  is_owner: boolean;
  is_disabled: boolean;
  work_time_percent: string;
  status: string;
  termination_date: string;
  note: string;
}

const emptyForm: EmployeeForm = {
  employee_number: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  jmbg: "",
  date_of_birth: "",
  gender: "",
  address: "",
  city: "",
  postal_code: "",
  phone: "",
  email: "",
  education_level: "",
  job_title: "",
  org_unit_id: "",
  employment_date: "",
  employment_type: "neodredjeno",
  contract_end_date: "",
  work_experience_years: "0",
  work_experience_months: "0",
  bank_account: "",
  is_owner: false,
  is_disabled: false,
  work_time_percent: "100",
  status: "active",
  termination_date: "",
  note: "",
};

export default function EmployeeEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const { user, selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canWrite = hasAccess("zarade.zaposleni", "write");
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: employee, isLoading } = useEmployee(isNew ? undefined : id);
  const { data: nextNumber } = useNextEmployeeNumber();
  const { units } = useOrganizationalUnits(selectedCompany?.id);
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [form, setForm] = useState<EmployeeForm>(emptyForm);

  useEffect(() => {
    if (isNew && nextNumber) {
      setForm((prev) => ({ ...prev, employee_number: nextNumber }));
    }
  }, [isNew, nextNumber]);

  useEffect(() => {
    if (employee) {
      setForm({
        employee_number: employee.employee_number,
        first_name: employee.first_name,
        middle_name: employee.middle_name || "",
        last_name: employee.last_name,
        jmbg: employee.jmbg || "",
        date_of_birth: employee.date_of_birth || "",
        gender: employee.gender || "",
        address: employee.address || "",
        city: employee.city || "",
        postal_code: employee.postal_code || "",
        phone: employee.phone || "",
        email: employee.email || "",
        education_level: employee.education_level || "",
        job_title: employee.job_title || "",
        org_unit_id: employee.org_unit_id || "",
        employment_date: employee.employment_date || "",
        employment_type: employee.employment_type,
        contract_end_date: employee.contract_end_date || "",
        work_experience_years: String(employee.work_experience_years || 0),
        work_experience_months: String(employee.work_experience_months || 0),
        bank_account: employee.bank_account || "",
        is_owner: employee.is_owner || false,
        is_disabled: employee.is_disabled || false,
        work_time_percent: String(employee.work_time_percent ?? 100),
        status: employee.status,
        termination_date: employee.termination_date || "",
        note: employee.note || "",
      });
    }
  }, [employee]);

  const handleChange = (field: keyof EmployeeForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Ime i prezime su obavezni");
      return;
    }
    if (!form.employee_number.trim()) {
      toast.error("Šifra zaposlenog je obavezna");
      return;
    }
    if (!selectedCompany?.id || !user?.id) return;

    const payload = {
      company_id: selectedCompany.id,
      employee_number: form.employee_number.trim(),
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      jmbg: form.jmbg || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      address: form.address || null,
      city: form.city || null,
      postal_code: form.postal_code || null,
      phone: form.phone || null,
      email: form.email || null,
      education_level: form.education_level || null,
      job_title: form.job_title || null,
      org_unit_id: form.org_unit_id || null,
      employment_date: form.employment_date || null,
      employment_type: form.employment_type,
      contract_end_date: form.contract_end_date || null,
      work_experience_years: parseInt(form.work_experience_years) || 0,
      work_experience_months: parseInt(form.work_experience_months) || 0,
      bank_account: form.bank_account || null,
      is_active: form.status === "active",
      is_owner: form.is_owner,
      is_disabled: form.is_disabled,
      work_time_percent: parseInt(form.work_time_percent) || 100,
      status: form.status,
      termination_date: form.termination_date || null,
      note: form.note || null,
      created_by: user.id,
      leave_days_default: 20,
    };

    try {
      if (isNew) {
        const result = await createEmployee.mutateAsync(payload);
        navigate(`/zarade/zaposleni/${result.id}`, { replace: true });
      } else {
        await updateEmployee.mutateAsync({ id: id!, ...payload });
      }
    } catch {
      // Error handled in mutation
    }
  };

  const handleDelete = async () => {
    if (!id || !selectedCompany?.id) return;
    await deleteEmployee.mutateAsync({ id, companyId: selectedCompany.id });
    navigate("/zarade/zaposleni");
  };

  if (!isNew && isLoading) {
    return (
      <MainLayout title="Zaposleni">
        <div className="flex items-center justify-center py-12 text-muted-foreground">Učitavanje...</div>
      </MainLayout>
    );
  }

  const isPending = createEmployee.isPending || updateEmployee.isPending;

  return (
    <MainLayout title={isNew ? "Novi zaposleni" : `${form.last_name} ${form.first_name}`}>
      <div className="flex flex-col gap-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/zarade/zaposleni")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Nazad
          </Button>
          <div className="flex items-center gap-2">
            {!isNew && (
              <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
                <History className="w-4 h-4 mr-1" /> Istorija
              </Button>
            )}
            {!isNew && canWrite && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" /> Obriši
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Brisanje zaposlenog</AlertDialogTitle>
                    <AlertDialogDescription>
                      Da li ste sigurni? Ova akcija je nepovratna.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Otkaži</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Obriši</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canWrite && (
              <Button onClick={handleSave} disabled={isPending}>
                <Save className="w-4 h-4 mr-2" /> {isNew ? "Kreiraj" : "Sačuvaj"}
              </Button>
            )}
          </div>
        </div>

        {/* Lični podaci */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lični podaci</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Šifra zaposlenog *</Label>
                <Input
                  value={form.employee_number}
                  onChange={(e) => handleChange("employee_number", e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Ime *</Label>
                <Input
                  value={form.first_name}
                  onChange={(e) => handleChange("first_name", e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Srednje slovo</Label>
                <Input
                  value={form.middle_name}
                  onChange={(e) => handleChange("middle_name", e.target.value.slice(0, 2))}
                  maxLength={2}
                  disabled={!canWrite}
                  placeholder="SS"
                />
              </div>
              <div>
                <Label>Prezime *</Label>
                <Input
                  value={form.last_name}
                  onChange={(e) => handleChange("last_name", e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>JMBG</Label>
                <Input
                  value={form.jmbg}
                  onChange={(e) => handleChange("jmbg", e.target.value)}
                  maxLength={13}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Datum rođenja</Label>
                <LocaleDateInput
                  value={form.date_of_birth}
                  onChange={(v) => handleChange("date_of_birth", v)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Pol</Label>
                <Select value={form.gender} onValueChange={(v) => handleChange("gender", v)} disabled={!canWrite}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Muški</SelectItem>
                    <SelectItem value="F">Ženski</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Kontakt */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kontakt i adresa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label>Adresa</Label>
                <Input
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Poštanski broj</Label>
                <Input
                  value={form.postal_code}
                  onChange={(e) => handleChange("postal_code", e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Grad</Label>
                <Input
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Telefon</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  disabled={!canWrite}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zaposlenje */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Podaci o zaposlenju</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Radno mesto</Label>
                <Input
                  value={form.job_title}
                  onChange={(e) => handleChange("job_title", e.target.value)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Organizaciona jedinica</Label>
                <Select value={form.org_unit_id} onValueChange={(v) => handleChange("org_unit_id", v)} disabled={!canWrite}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.code} - {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Stručna sprema</Label>
                <Select value={form.education_level} onValueChange={(v) => handleChange("education_level", v)} disabled={!canWrite}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDUCATION_LEVELS.map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Datum zaposlenja</Label>
                <LocaleDateInput
                  value={form.employment_date}
                  onChange={(v) => handleChange("employment_date", v)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Vrsta ugovora</Label>
                <Select value={form.employment_type} onValueChange={(v) => handleChange("employment_type", v)} disabled={!canWrite}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.employment_type === "odredjeno" && (
                <div>
                  <Label>Ugovor do</Label>
                  <LocaleDateInput
                    value={form.contract_end_date}
                    onChange={(v) => handleChange("contract_end_date", v)}
                    disabled={!canWrite}
                  />
                </div>
              )}
              <div>
                <Label>Prethodni staž (godine)</Label>
                <LocaleNumberInput
                  value={form.work_experience_years}
                  onChange={(v) => handleChange("work_experience_years", v)}
                  decimalPlaces={0}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Prethodni staž (meseci)</Label>
                <LocaleNumberInput
                  value={form.work_experience_months}
                  onChange={(v) => handleChange("work_experience_months", v)}
                  decimalPlaces={0}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Tekući račun</Label>
                <Input
                  value={form.bank_account}
                  onChange={(e) => handleChange("bank_account", e.target.value)}
                  placeholder="XXX-XXXXXXXXXXXXX-XX"
                  disabled={!canWrite}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Status zaposlenog</Label>
                <Select value={form.status} onValueChange={(v) => handleChange("status", v)} disabled={!canWrite}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.status === "terminated" && (
                <div>
                  <Label>Datum prestanka</Label>
                  <LocaleDateInput
                    value={form.termination_date}
                    onChange={(v) => handleChange("termination_date", v)}
                    disabled={!canWrite}
                  />
                </div>
              )}
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="is_owner"
                  checked={form.is_owner}
                  onCheckedChange={(checked) => handleChange("is_owner", checked === true)}
                  disabled={!canWrite}
                />
                <Label htmlFor="is_owner" className="cursor-pointer">Vlasnik firme</Label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="is_disabled"
                  checked={form.is_disabled}
                  onCheckedChange={(checked) => handleChange("is_disabled", checked === true)}
                  disabled={!canWrite}
                />
                <Label htmlFor="is_disabled" className="cursor-pointer">Invalid</Label>
              </div>
              <div>
                <Label>Procenat radnog vremena (%)</Label>
                <LocaleNumberInput
                  value={form.work_time_percent}
                  onChange={(v) => handleChange("work_time_percent", v)}
                  decimalPlaces={0}
                  disabled={!canWrite}
                />
              </div>
            </div>
            <Separator className="my-4" />
            <div>
              <Label>Napomena</Label>
              <Textarea
                value={form.note}
                onChange={(e) => handleChange("note", e.target.value)}
                rows={3}
                disabled={!canWrite}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {!isNew && id && (
        <DocumentHistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          documentId={id}
          documentName={`${form.last_name} ${form.first_name}`}
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
