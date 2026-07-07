import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { LeaveRequest } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { leaveCalendarColor } from "@/lib/statusStyles";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function eventColorKey(lr: LeaveRequest): string {
  if (lr.isPlanned) return "PLANNED";
  return lr.status;
}

export default function LeaveCalendarPage() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [events, setEvents] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    api.get<LeaveRequest[]>("/leave-requests/calendar", { params: { month, year } }).then((res) => setEvents(res.data));
  }, [month, year]);

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
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const eventsByDay = useMemo(() => {
    const map = new Map<number, LeaveRequest[]>();
    for (const ev of events) {
      const start = new Date(ev.startDate);
      const end = new Date(ev.endDate);
      for (let d = 1; d <= daysInMonth; d++) {
        const cur = new Date(Date.UTC(year, month - 1, d));
        if (cur >= new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) &&
            cur <= new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))) {
          if (!map.has(d)) map.set(d, []);
          map.get(d)!.push(ev);
        }
      }
    }
    return map;
  }, [events, daysInMonth, month, year]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-base font-semibold text-slate-800">
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
              const dayEvents = eventsByDay.get(day) || [];
              return (
                <div key={day} className="flex min-h-[4.5rem] flex-col gap-1 rounded-lg border border-slate-100 p-1 text-left">
                  <span className="text-[11px] font-medium text-slate-500">{day}</span>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        title={`${ev.employee ? ev.employee.firstName + " " + ev.employee.lastName + " — " : ""}${ev.leaveType.name} (${ev.status})`}
                        className={cn("truncate rounded px-1 py-0.5 text-[9px] font-medium text-white", leaveCalendarColor[eventColorKey(ev)])}
                      >
                        {user?.role === "ADMIN" && ev.employee ? `${ev.employee.firstName} ` : ""}
                        {ev.leaveType.code}
                      </div>
                    ))}
                    {dayEvents.length > 3 && <span className="text-[9px] text-slate-400">+{dayEvents.length - 3} more</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Approved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Planned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Rejected
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
