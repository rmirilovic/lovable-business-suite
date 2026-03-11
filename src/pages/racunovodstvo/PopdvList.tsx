import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePopdvReports } from "@/hooks/usePopdvReports";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, FileText, Trash2, ListChecks } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter } from "date-fns";
import { sr } from "date-fns/locale";
import { toast } from "sonner";

const MONTHS = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"
];

const QUARTERS = ["Q1 (Jan-Mar)", "Q2 (Apr-Jun)", "Q3 (Jul-Sep)", "Q4 (Okt-Dec)"];

export default function PopdvList() {
  const navigate = useNavigate();
  const { selectedCompany, selectedYear } = useAuth();
  const { reportsQuery, createReport, deleteReport } = usePopdvReports();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [periodType, setPeriodType] = useState<string>("monthly");
  const [selectedMonth, setSelectedMonth] = useState<string>("0");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("0");

  const year = selectedYear?.year || new Date().getFullYear();

  const handleCreate = () => {
    const isMonthly = periodType === "monthly";
    let periodStart: Date, periodEnd: Date, label: string;

    if (isMonthly) {
      const monthIdx = parseInt(selectedMonth);
      periodStart = startOfMonth(new Date(year, monthIdx));
      periodEnd = endOfMonth(new Date(year, monthIdx));
      label = `${MONTHS[monthIdx]} ${year}`;
    } else {
      const qIdx = parseInt(selectedQuarter);
      periodStart = startOfQuarter(new Date(year, qIdx * 3));
      periodEnd = endOfQuarter(new Date(year, qIdx * 3));
      label = `Q${qIdx + 1} ${year}`;
    }

    createReport.mutate({
      period_type: periodType,
      period_start: format(periodStart, "yyyy-MM-dd"),
      period_end: format(periodEnd, "yyyy-MM-dd"),
      period_label: label,
    }, {
      onSuccess: (report) => {
        setShowCreate(false);
        navigate(`/racunovodstvo/popdv/${report.id}`);
      },
    });
  };

  const reports = reportsQuery.data || [];
  const filtered = reports.filter(r =>
    r.period_label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout title="POPDV Obrasci">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">POPDV Obrasci</h1>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pretraži po periodu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/racunovodstvo/popdv/documents-report")} className="gap-2">
              <ListChecks className="w-4 h-4" />
              Pregled dokumenata
            </Button>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Novi POPDV
            </Button>
          </div>
        </div>

        <div className="erp-card overflow-hidden">
          {reportsQuery.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Učitavanje...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nema POPDV obrazaca za odabranu godinu</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Period</TableHead>
                  <TableHead className="w-[100px]">Tip</TableHead>
                  <TableHead className="w-[120px]">Od</TableHead>
                  <TableHead className="w-[120px]">Do</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[130px]">Kreiran</TableHead>
                  <TableHead className="w-[80px]">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/racunovodstvo/popdv/${r.id}`)}
                  >
                    <TableCell className="font-medium">{r.period_label}</TableCell>
                    <TableCell>{r.period_type === "monthly" ? "Mesečni" : "Kvartalni"}</TableCell>
                    <TableCell>{format(new Date(r.period_start), "dd.MM.yyyy")}</TableCell>
                    <TableCell>{format(new Date(r.period_end), "dd.MM.yyyy")}</TableCell>
                    <TableCell>
                      <span className={r.status === "finalized" ? "erp-badge-success" : "erp-badge-warning"}>
                        {r.status === "finalized" ? "Zaključen" : "Nacrt"}
                      </span>
                    </TableCell>
                    <TableCell>{format(new Date(r.created_at), "dd.MM.yyyy")}</TableCell>
                    <TableCell>
                      {r.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Obrisati ovaj POPDV obrazac?")) {
                              deleteReport.mutate(r.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novi POPDV obrazac</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tip perioda</Label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mesečni</SelectItem>
                  <SelectItem value="quarterly">Kvartalni</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {periodType === "monthly" ? (
              <div className="space-y-2">
                <Label>Mesec</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={String(i)}>{m} {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Kvartal</Label>
                <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map((q, i) => (
                      <SelectItem key={i} value={String(i)}>{q} {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Otkaži</Button>
            <Button onClick={handleCreate} disabled={createReport.isPending}>
              {createReport.isPending ? "Kreiranje..." : "Kreiraj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
