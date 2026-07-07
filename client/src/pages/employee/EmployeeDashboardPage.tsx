import { useEffect, useState } from "react";
import { Clock, LogIn, LogOut, CalendarClock, Timer, PartyPopper } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";
import { AttendanceCalendar } from "@/components/shared/AttendanceCalendar";
import { formatDate, formatTime } from "@/lib/utils";
import { attendanceStatusVariant, holidayTypeLabel } from "@/lib/statusStyles";
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await api.get<EmployeeDashboardData>("/dashboard/employee");
    setData(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function timeIn() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/attendance/time-in", { device: navigator.userAgent, browser: "Web" });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function timeOut() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/attendance/time-out", {});
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <PageSpinner />;

  const totalLeaveRemaining = data.leaveBalances.reduce((s, b) => s + b.remainingDays, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Clock className="h-8 w-8" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Current status</p>
            {data.todayAttendance ? (
              <Badge variant={attendanceStatusVariant[data.todayAttendance.status]} className="mt-1 text-sm">
                {data.todayAttendance.status.replace("_", " ")}
              </Badge>
            ) : (
              <Badge variant="outline" className="mt-1 text-sm">
                Not timed in
              </Badge>
            )}
          </div>
          {error && (
            <div className="w-full max-w-sm">
              <Alert>{error}</Alert>
            </div>
          )}
          <div className="flex gap-4 text-sm text-slate-600">
            <span>
              Time In: <strong>{formatTime(data.todayAttendance?.timeIn)}</strong>
            </span>
            <span>
              Time Out: <strong>{formatTime(data.todayAttendance?.timeOut)}</strong>
            </span>
          </div>
          <div className="flex gap-3">
            <Button onClick={timeIn} disabled={busy || !!data.todayAttendance?.timeIn}>
              <LogIn className="h-4 w-4" /> Time In
            </Button>
            <Button
              variant="outline"
              onClick={timeOut}
              disabled={busy || !data.todayAttendance?.timeIn || !!data.todayAttendance?.timeOut}
            >
              <LogOut className="h-4 w-4" /> Time Out
            </Button>
          </div>
        </CardContent>
      </Card>

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
