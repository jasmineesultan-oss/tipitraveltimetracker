import { useEffect, useState } from "react";
import { CalendarClock, Timer, PartyPopper } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageSpinner } from "@/components/shared/Spinner";
import { AttendanceCalendar } from "@/components/shared/AttendanceCalendar";
import { MyTimeTrackingCard } from "@/components/shared/MyTimeTrackingCard";
import { formatDate } from "@/lib/utils";
import { holidayTypeLabel } from "@/lib/statusStyles";
import type { Attendance } from "@/types";

interface EmployeeDashboardData {
  todayAttendance: Attendance | null;
  weeklyHours: number;
  monthlyHours: number;
  leaveBalances: any[];
  upcomingHolidays: any[];
}

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<EmployeeDashboardData | null>(null);

  useEffect(() => {
    api.get<EmployeeDashboardData>("/dashboard/employee").then((res) => setData(res.data));
  }, []);

  if (!data) return <PageSpinner />;

  const totalLeaveRemaining = data.leaveBalances.reduce((s, b) => s + b.remainingDays, 0);

  return (
    <div className="space-y-6">
      <MyTimeTrackingCard />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's Hours" value={`${data.todayAttendance?.totalHours ?? 0}h`} icon={Timer} accent="brand" />
        <StatCard label="Weekly Hours" value={`${data.weeklyHours}h`} icon={Timer} accent="emerald" />
        <StatCard label="Monthly Hours" value={`${data.monthlyHours}h`} icon={Timer} accent="purple" />
        <StatCard label="Leave Balance" value={`${totalLeaveRemaining}d`} icon={CalendarClock} accent="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Calendar</CardTitle>
          </CardHeader>
          <CardContent>{user?.employee && <AttendanceCalendar employeeId={user.employee.id} />}</CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Leave Balance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.leaveBalances.map((b) => (
                <div key={b.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{b.leaveType.name}</span>
                  <span className="font-medium text-slate-900">
                    {b.remainingDays} / {b.allocatedDays} days
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Holidays</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.upcomingHolidays.length === 0 && <p className="text-sm text-slate-400">No upcoming holidays</p>}
              {data.upcomingHolidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <PartyPopper className="h-4 w-4 text-brand-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{h.name}</p>
                      <p className="text-xs text-slate-500">{formatDate(h.date)}</p>
                    </div>
                  </div>
                  <Badge variant="info">{holidayTypeLabel[h.type]}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
