import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import type { Attendance } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const statusColor: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-700 border-emerald-200",
  LATE: "bg-amber-100 text-amber-700 border-amber-200",
  ABSENT: "bg-red-100 text-red-700 border-red-200",
  HALF_DAY: "bg-blue-100 text-blue-700 border-blue-200",
  ON_LEAVE: "bg-purple-100 text-purple-700 border-purple-200",
  HOLIDAY: "bg-cyan-100 text-cyan-700 border-cyan-200",
  WEEKEND: "bg-slate-100 text-slate-400 border-slate-200",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function AttendanceCalendar({ employeeId }: { employeeId: string }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [records, setRecords] = useState<Attendance[]>([]);

  useEffect(() => {
    if (!employeeId) return;
    api.get<Attendance[]>(`/attendance/calendar/${employeeId}`, { params: { month, year } }).then((res) => setRecords(res.data));
  }, [employeeId, month, year]);

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const recordByDay = new Map(records.map((r) => [new Date(r.date).getUTCDate(), r]));

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-slate-800">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="pb-1 font-medium text-slate-400">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const record = recordByDay.get(day);
          return (
            <div
              key={day}
              className={cn(
                "flex h-14 flex-col items-center justify-center rounded-lg border text-xs",
                record ? statusColor[record.status] : "border-slate-100 text-slate-400"
              )}
              title={record?.status}
            >
              <span className="font-medium">{day}</span>
              {record && <span className="text-[9px] uppercase">{record.status.replace("_", " ")}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        {Object.entries(statusColor).map(([status, cls]) => (
          <span key={status} className={cn("rounded-full border px-2 py-0.5", cls)}>
            {status.replace("_", " ")}
          </span>
        ))}
      </div>
    </div>
  );
}
