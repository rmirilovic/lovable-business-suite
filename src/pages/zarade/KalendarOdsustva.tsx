import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAbsences, ABSENCE_TYPE_LABELS, ABSENCE_TYPE_COLORS } from "@/hooks/useAbsences";
import { useEmployees } from "@/hooks/useEmployees";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isWeekend, parseISO, isSameMonth, isWithinInterval,
} from "date-fns";
import { sr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ABSENCE_CELL_COLORS: Record<string, string> = {
  godisnji_odmor: "bg-blue-200 dark:bg-blue-800",
  bolovanje: "bg-red-200 dark:bg-red-800",
  placeno_odsustvo: "bg-green-200 dark:bg-green-800",
  neplaceno_odsustvo: "bg-yellow-200 dark:bg-yellow-800",
};

const DAY_NAMES = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

export default function KalendarOdsustva() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState("__all__");
  const { data: absences } = useAbsences();
  const { data: employees } = useEmployees();

  const activeEmployees = useMemo(
    () => (employees || []).filter((e) => e.status === "active").sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [employees]
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const filteredAbsences = useMemo(() => {
    if (!absences) return [];
    return absences.filter((a) => {
      const s = parseISO(a.start_date);
      const e = parseISO(a.end_date);
      const overlaps = s <= monthEnd && e >= monthStart;
      const matchesType = typeFilter === "__all__" || a.absence_type === typeFilter;
      return overlaps && matchesType;
    });
  }, [absences, monthStart, monthEnd, typeFilter]);

  const absenceMap = useMemo(() => {
    const m = new Map<string, Map<string, string>>();
    for (const a of filteredAbsences) {
      const s = parseISO(a.start_date) < monthStart ? monthStart : parseISO(a.start_date);
      const e = parseISO(a.end_date) > monthEnd ? monthEnd : parseISO(a.end_date);
      const days = eachDayOfInterval({ start: s, end: e });
      for (const d of days) {
        const dk = format(d, "yyyy-MM-dd");
        if (!m.has(a.employee_id)) m.set(a.employee_id, new Map());
        m.get(a.employee_id)!.set(dk, a.absence_type);
      }
    }
    return m;
  }, [filteredAbsences, monthStart, monthEnd]);

  return (
    <MainLayout title="Kalendar odsustva">
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4 h-full">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium min-w-[160px] text-center capitalize">
              {format(currentMonth, "LLLL yyyy", { locale: sr })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tip odsustva" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Svi tipovi</SelectItem>
              {Object.entries(ABSENCE_TYPE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {Object.entries(ABSENCE_TYPE_LABELS).map(([key, label]) => (
              <Badge key={key} variant="outline" className={ABSENCE_TYPE_COLORS[key]}>
                {label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="overflow-auto flex-1 min-h-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-background border px-2 py-1 text-left min-w-[180px]">Zaposleni</th>
                {daysInMonth.map((d) => {
                  const weekend = isWeekend(d);
                  return (
                    <th
                      key={d.toISOString()}
                      className={`border px-1 py-1 text-center min-w-[32px] ${weekend ? "bg-muted/60" : ""}`}
                    >
                      <div className="text-xs">{format(d, "d")}</div>
                      <div className="text-[10px] text-muted-foreground">{DAY_NAMES[(getDay(d) + 6) % 7]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td className="sticky left-0 z-10 bg-background border px-2 py-1 font-medium whitespace-nowrap">
                    {emp.last_name} {emp.first_name}
                  </td>
                  {daysInMonth.map((d) => {
                    const dk = format(d, "yyyy-MM-dd");
                    const empAbsences = absenceMap.get(emp.id);
                    const absType = empAbsences?.get(dk);
                    const weekend = isWeekend(d);
                    return (
                      <td
                        key={dk}
                        className={`border px-0 py-0 text-center h-8 ${
                          absType
                            ? ABSENCE_CELL_COLORS[absType]
                            : weekend
                              ? "bg-muted/40"
                              : ""
                        }`}
                      >
                        {absType && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-full h-full min-h-[2rem]" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{ABSENCE_TYPE_LABELS[absType]}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {activeEmployees.length === 0 && (
                <tr>
                  <td colSpan={daysInMonth.length + 1} className="border px-2 py-4 text-center text-muted-foreground">
                    Nema aktivnih zaposlenih
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
