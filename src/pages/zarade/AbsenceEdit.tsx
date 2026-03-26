import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LocaleDateInput } from "@/components/ui/locale-date-input";
import { LocaleNumberInput } from "@/components/ui/locale-number-input";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAbsence, useCreateAbsence, useUpdateAbsence, useDeleteAbsence,
  ABSENCE_TYPE_LABELS,
} from "@/hooks/useAbsences";
import { useEmployees } from "@/hooks/useEmployees";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { differenceInBusinessDays, parseISO, isWeekend, eachDayOfInterval } from "date-fns";

interface AbsenceForm {
  employee_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  work_days: string;
  note: string;
}

const emptyForm: AbsenceForm = {
  employee_id: "",
  absence_type: "godisnji_odmor",
  start_date: "",
  end_date: "",
  work_days: "0",
  note: "",
};

function countWorkDays(start: string, end: string): number {
  if (!start || !end) return 0;
  try {
    const s = parseISO(start);
    const e = parseISO(end);
    if (e < s) return 0;
    const days = eachDayOfInterval({ start: s, end: e });
    return days.filter((d) => !isWeekend(d)).length;
  } catch {
    return 0;
  }
}

export default function AbsenceEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const { user, selectedCompany } = useAuth();
  const { hasAccess } = usePermissions();
  const canWrite = hasAccess("zarade.odsustva", "write");

  const { data: absence, isLoading } = useAbsence(isNew ? undefined : id);
  const { data: employees } = useEmployees();
  const createAbsence = useCreateAbsence();
  const updateAbsence = useUpdateAbsence();
  const deleteAbsence = useDeleteAbsence();

  const [form, setForm] = useState<AbsenceForm>(emptyForm);

  const activeEmployees = useMemo(
    () => (employees || []).filter((e) => e.status === "active").sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [employees]
  );

  useEffect(() => {
    if (absence) {
      setForm({
        employee_id: absence.employee_id,
        absence_type: absence.absence_type,
        start_date: absence.start_date,
        end_date: absence.end_date,
        work_days: String(absence.work_days),
        note: absence.note || "",
      });
    }
  }, [absence]);

  const handleChange = (field: keyof AbsenceForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "start_date" || field === "end_date") {
        const s = field === "start_date" ? value : prev.start_date;
        const e = field === "end_date" ? value : prev.end_date;
        next.work_days = String(countWorkDays(s, e));
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.employee_id) {
      toast.error("Izaberite zaposlenog");
      return;
    }
    if (!form.start_date || !form.end_date) {
      toast.error("Datumi su obavezni");
      return;
    }
    if (!selectedCompany?.id || !user?.id) return;

    const payload = {
      company_id: selectedCompany.id,
      employee_id: form.employee_id,
      absence_type: form.absence_type,
      start_date: form.start_date,
      end_date: form.end_date,
      work_days: parseInt(form.work_days) || 0,
      note: form.note || null,
      created_by: user.id,
    };

    try {
      if (isNew) {
        const result = await createAbsence.mutateAsync(payload);
        navigate(`/zarade/odsustva/${result.id}`, { replace: true });
      } else {
        await updateAbsence.mutateAsync({ id: id!, ...payload });
      }
    } catch {
      // handled in mutation
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteAbsence.mutateAsync({ id });
    navigate("/zarade/odsustva");
  };

  if (!isNew && isLoading) {
    return (
      <MainLayout title="Odsustvo">
        <div className="flex items-center justify-center py-12 text-muted-foreground">Učitavanje...</div>
      </MainLayout>
    );
  }

  const isPending = createAbsence.isPending || updateAbsence.isPending;
  const selectedEmp = employees?.find((e) => e.id === form.employee_id);
  const title = isNew
    ? "Novo odsustvo"
    : selectedEmp
      ? `${selectedEmp.last_name} ${selectedEmp.first_name} — ${ABSENCE_TYPE_LABELS[form.absence_type]}`
      : "Odsustvo";

  return (
    <MainLayout title={title}>
      <div className="flex flex-col gap-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/zarade/odsustva")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Nazad
          </Button>
          <div className="flex items-center gap-2">
            {!isNew && canWrite && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="w-4 h-4 mr-2" /> Obriši
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Brisanje odsustva</AlertDialogTitle>
                    <AlertDialogDescription>Da li ste sigurni? Ova akcija je nepovratna.</AlertDialogDescription>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Podaci o odsustvu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Zaposleni *</Label>
                <Select value={form.employee_id} onValueChange={(v) => handleChange("employee_id", v)} disabled={!canWrite}>
                  <SelectTrigger>
                    <SelectValue placeholder="Izaberite zaposlenog" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.employee_number} — {e.last_name} {e.first_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tip odsustva *</Label>
                <Select value={form.absence_type} onValueChange={(v) => handleChange("absence_type", v)} disabled={!canWrite}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ABSENCE_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Datum od *</Label>
                <LocaleDateInput
                  value={form.start_date}
                  onChange={(v) => handleChange("start_date", v)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Datum do *</Label>
                <LocaleDateInput
                  value={form.end_date}
                  onChange={(v) => handleChange("end_date", v)}
                  disabled={!canWrite}
                />
              </div>
              <div>
                <Label>Radnih dana</Label>
                <LocaleNumberInput
                  value={form.work_days}
                  onChange={(v) => handleChange("work_days", v)}
                  decimalPlaces={0}
                  disabled={!canWrite}
                />
              </div>
            </div>
            <div className="mt-4">
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
    </MainLayout>
  );
}
