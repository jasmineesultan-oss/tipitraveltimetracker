import { useEffect, useState } from "react";
import { Clock, LogIn, LogOut, CalendarClock, Timer, PartyPopper, Wrench, Pencil, Check } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";
import { AttendanceCalendar } from "@/components/shared/AttendanceCalendar";
import { cn, formatDate, formatTime, phLocalToUtcIso, utcIsoToPhLocalTime } from "@/lib/utils";
import { attendanceStatusVariant, holidayTypeLabel, workTypeLabel } from "@/lib/statusStyles";
import type { Attendance, WorkType } from "@/types";

function todayPhDateStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

function maxCorrectionDate(): string {
  const [y, m, d] = todayPhDateStr().split("-").map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
  return yesterday.toISOString().slice(0, 10);
}

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
  const [workType, setWorkType] = useState<WorkType>("OFFICE");

  const [correctionDate, setCorrectionDate] = useState("");
  const [correctionTimeIn, setCorrectionTimeIn] = useState("");
  const [correctionTimeOut, setCorrectionTimeOut] = useState("");
  const [correctionWorkType, setCorrectionWorkType] = useState<WorkType>("OFFICE");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionSuccess, setCorrectionSuccess] = useState(false);
  const [correctionBusy, setCorrectionBusy] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  const [editingTimeIn, setEditingTimeIn] = useState(false);
  const [editingTimeOut, setEditingTimeOut] = useState(false);
  const [timeInDraft, setTimeInDraft] = useState("");
  const [timeOutDraft, setTimeOutDraft] = useState("");
  const [inlineBusy, setInlineBusy] = useState(false);

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
      await api.post("/attendance/time-in", { device: navigator.userAgent, browser: "Web", workType });
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

  function startEditTimeIn() {
    setTimeInDraft(data?.todayAttendance?.timeIn ? utcIsoToPhLocalTime(data.todayAttendance.timeIn) : "");
    setError(null);
    setEditingTimeIn(true);
  }

  function startEditTimeOut() {
    setTimeOutDraft(data?.todayAttendance?.timeOut ? utcIsoToPhLocalTime(data.todayAttendance.timeOut) : "");
    setError(null);
    setEditingTimeOut(true);
  }

  async function saveInlineTimeIn() {
    if (!timeInDraft) return;
    setInlineBusy(true);
    setError(null);
    try {
      await api.post("/attendance/self-correction", {
        date: todayPhDateStr(),
        timeIn: phLocalToUtcIso(todayPhDateStr(), timeInDraft),
      });
      setEditingTimeIn(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setInlineBusy(false);
    }
  }

  async function saveInlineTimeOut() {
    if (!timeOutDraft) return;
    setInlineBusy(true);
    setError(null);
    try {
      await api.post("/attendance/self-correction", {
        date: todayPhDateStr(),
        timeOut: phLocalToUtcIso(todayPhDateStr(), timeOutDraft),
      });
      setEditingTimeOut(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setInlineBusy(false);
    }
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    setCorrectionError(null);
    setCorrectionSuccess(false);

    if (!correctionDate) {
      setCorrectionError("Select the date you're correcting");
      return;
    }
    if (!correctionTimeIn && !correctionTimeOut) {
      setCorrectionError("Provide at least a time in or time out");
      return;
    }

    setCorrectionBusy(true);
    try {
      await api.post("/attendance/self-correction", {
        date: correctionDate,
        timeIn: correctionTimeIn ? phLocalToUtcIso(correctionDate, correctionTimeIn) : undefined,
        timeOut: correctionTimeOut ? phLocalToUtcIso(correctionDate, correctionTimeOut) : undefined,
        workType: correctionWorkType,
        notes: correctionNotes || undefined,
      });
      setCorrectionSuccess(true);
      setCorrectionDate("");
      setCorrectionTimeIn("");
      setCorrectionTimeOut("");
      setCorrectionWorkType("OFFICE");
      setCorrectionNotes("");
      setCalendarRefreshKey((k) => k + 1);
      await load();
    } catch (err) {
      setCorrectionError(apiErrorMessage(err));
    } finally {
      setCorrectionBusy(false);
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
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
            <div className="flex items-center gap-1.5">
              <span>Time In:</span>
              {data.todayAttendance?.timeIn ? (
                <>
                  <Input
                    type="time"
                    value={editingTimeIn ? timeInDraft : utcIsoToPhLocalTime(data.todayAttendance.timeIn)}
                    onChange={(e) => setTimeInDraft(e.target.value)}
                    disabled={!editingTimeIn}
                    className={cn(
                      "h-7 w-24 px-2 py-0 text-sm",
                      !editingTimeIn && "cursor-default border-transparent bg-transparent p-0 font-semibold text-slate-900 shadow-none"
                    )}
                  />
                  {editingTimeIn ? (
                    <button
                      type="button"
                      onClick={saveInlineTimeIn}
                      disabled={inlineBusy}
                      className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                      aria-label="Save Time In"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditTimeIn}
                      className="text-slate-400 hover:text-slate-600"
                      aria-label="Edit Time In"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <strong>{formatTime(data.todayAttendance?.timeIn)}</strong>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span>Time Out:</span>
              {data.todayAttendance?.timeIn ? (
                <>
                  <Input
                    type="time"
                    value={
                      editingTimeOut
                        ? timeOutDraft
                        : data.todayAttendance?.timeOut
                        ? utcIsoToPhLocalTime(data.todayAttendance.timeOut)
                        : ""
                    }
                    onChange={(e) => setTimeOutDraft(e.target.value)}
                    disabled={!editingTimeOut}
                    className={cn(
                      "h-7 w-24 px-2 py-0 text-sm",
                      !editingTimeOut && "cursor-default border-transparent bg-transparent p-0 font-semibold text-slate-900 shadow-none"
                    )}
                  />
                  {editingTimeOut ? (
                    <button
                      type="button"
                      onClick={saveInlineTimeOut}
                      disabled={inlineBusy}
                      className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                      aria-label="Save Time Out"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startEditTimeOut}
                      className="text-slate-400 hover:text-slate-600"
                      aria-label="Edit Time Out"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <strong>{formatTime(data.todayAttendance?.timeOut)}</strong>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Select value={workType} onValueChange={(v) => setWorkType(v as WorkType)} disabled={!!data.todayAttendance?.timeIn}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OFFICE">{workTypeLabel.OFFICE}</SelectItem>
                <SelectItem value="WORK_FROM_HOME">{workTypeLabel.WORK_FROM_HOME}</SelectItem>
                <SelectItem value="FIELD_WORK">{workTypeLabel.FIELD_WORK}</SelectItem>
              </SelectContent>
            </Select>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-slate-500" />
            Need to log or fix a past day? Use this form.
          </CardTitle>
          <CardDescription>
            For past dates only - to fix today's Time In / Time Out, edit them directly above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitCorrection} className="space-y-3">
            {correctionError && <Alert>{correctionError}</Alert>}
            {correctionSuccess && <Alert variant="success">Correction submitted. Your admin has been notified.</Alert>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  max={maxCorrectionDate()}
                  value={correctionDate}
                  onChange={(e) => setCorrectionDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Time In</Label>
                <Input type="time" value={correctionTimeIn} onChange={(e) => setCorrectionTimeIn(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Time Out</Label>
                <Input type="time" value={correctionTimeOut} onChange={(e) => setCorrectionTimeOut(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Work Type</Label>
                <Select value={correctionWorkType} onValueChange={(v) => setCorrectionWorkType(v as WorkType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OFFICE">{workTypeLabel.OFFICE}</SelectItem>
                    <SelectItem value="WORK_FROM_HOME">{workTypeLabel.WORK_FROM_HOME}</SelectItem>
                    <SelectItem value="FIELD_WORK">{workTypeLabel.FIELD_WORK}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
                placeholder="e.g. Forgot to time out after client visit"
              />
            </div>
            <Button type="submit" variant="outline" disabled={correctionBusy}>
              Submit Correction
            </Button>
          </form>
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
          <CardContent>{user?.employee && <AttendanceCalendar key={calendarRefreshKey} employeeId={user.employee.id} />}</CardContent>
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
