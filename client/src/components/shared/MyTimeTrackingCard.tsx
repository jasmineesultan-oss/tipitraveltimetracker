import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, LogIn, LogOut, Pencil, Check, ArrowRight } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert } from "@/components/shared/Alert";
import { Spinner } from "@/components/shared/Spinner";
import { cn, phLocalToUtcIso, todayPhDateStr, utcIsoToPhLocalTime } from "@/lib/utils";
import { attendanceStatusVariant, workTypeLabel, workTypeVariant } from "@/lib/statusStyles";
import type { Attendance, WorkType } from "@/types";

interface EditingSessionField {
  sessionId: string;
  field: "timeIn" | "timeOut";
}

/**
 * Self-contained Time In/Out card: fetches and refreshes its own today's-attendance
 * data, so it can be dropped into any page (employee or admin dashboard) with no
 * extra wiring from the parent.
 */
export function MyTimeTrackingCard() {
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [workType, setWorkType] = useState<WorkType>("OFFICE");

  const [editingSessionField, setEditingSessionField] = useState<EditingSessionField | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [inlineBusy, setInlineBusy] = useState(false);

  async function load() {
    const { data } = await api.get<Attendance | null>("/attendance/today");
    setTodayAttendance(data);
    setLoaded(true);
  }

  useEffect(() => {
    load();
  }, []);

  const sessions = todayAttendance?.sessions ?? [];
  const openSession = sessions.find((s) => !s.timeOut);

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

  function startEditSession(sessionId: string, field: "timeIn" | "timeOut", currentValue?: string | null) {
    setDraftValue(currentValue ? utcIsoToPhLocalTime(currentValue) : "");
    setError(null);
    setEditingSessionField({ sessionId, field });
  }

  async function saveEditSession() {
    if (!editingSessionField || !draftValue) return;
    setInlineBusy(true);
    setError(null);
    try {
      await api.post("/attendance/self-correction", {
        date: todayPhDateStr(),
        sessionId: editingSessionField.sessionId,
        [editingSessionField.field]: phLocalToUtcIso(todayPhDateStr(), draftValue),
      });
      setEditingSessionField(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setInlineBusy(false);
    }
  }

  if (!loaded) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Clock className="h-8 w-8" />
        </div>
        <div>
          <p className="text-sm text-slate-500">Current status</p>
          {todayAttendance ? (
            <Badge variant={attendanceStatusVariant[todayAttendance.status]} className="mt-1 text-sm">
              {todayAttendance.status.replace("_", " ")}
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

        {sessions.length > 0 && (
          <div className="flex w-full flex-col gap-2">
            {sessions.map((s) => {
              const isEditingIn = editingSessionField?.sessionId === s.id && editingSessionField.field === "timeIn";
              const isEditingOut = editingSessionField?.sessionId === s.id && editingSessionField.field === "timeOut";
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm text-slate-600"
                >
                  <Badge variant={workTypeVariant[s.workType]}>{workTypeLabel[s.workType]}</Badge>
                  <div className="flex items-center gap-1.5">
                    <span>In:</span>
                    <Input
                      type="time"
                      value={isEditingIn ? draftValue : utcIsoToPhLocalTime(s.timeIn)}
                      onChange={(e) => setDraftValue(e.target.value)}
                      disabled={!isEditingIn}
                      className={cn(
                        "h-7 w-24 px-2 py-0 text-sm",
                        !isEditingIn && "cursor-default border-transparent bg-transparent p-0 font-semibold text-slate-900 shadow-none"
                      )}
                    />
                    {isEditingIn ? (
                      <button
                        type="button"
                        onClick={saveEditSession}
                        disabled={inlineBusy}
                        className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                        aria-label="Save Time In"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditSession(s.id, "timeIn", s.timeIn)}
                        className="text-slate-400 hover:text-slate-600"
                        aria-label="Edit Time In"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span>Out:</span>
                    {s.timeOut ? (
                      <>
                        <Input
                          type="time"
                          value={isEditingOut ? draftValue : utcIsoToPhLocalTime(s.timeOut)}
                          onChange={(e) => setDraftValue(e.target.value)}
                          disabled={!isEditingOut}
                          className={cn(
                            "h-7 w-24 px-2 py-0 text-sm",
                            !isEditingOut && "cursor-default border-transparent bg-transparent p-0 font-semibold text-slate-900 shadow-none"
                          )}
                        />
                        {isEditingOut ? (
                          <button
                            type="button"
                            onClick={saveEditSession}
                            disabled={inlineBusy}
                            className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                            aria-label="Save Time Out"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditSession(s.id, "timeOut", s.timeOut)}
                            className="text-slate-400 hover:text-slate-600"
                            aria-label="Edit Time Out"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">In progress</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Select value={workType} onValueChange={(v) => setWorkType(v as WorkType)} disabled={!!openSession}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OFFICE">{workTypeLabel.OFFICE}</SelectItem>
              <SelectItem value="WORK_FROM_HOME">{workTypeLabel.WORK_FROM_HOME}</SelectItem>
              <SelectItem value="FIELD_WORK">{workTypeLabel.FIELD_WORK}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={timeIn} disabled={busy || !!openSession}>
            <LogIn className="h-4 w-4" /> Time In
          </Button>
          <Button variant="outline" onClick={timeOut} disabled={busy || !openSession}>
            <LogOut className="h-4 w-4" /> Time Out
          </Button>
        </div>
        <Link to="/my-attendance" className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 hover:underline">
          Need to fix an earlier day? Go to My Attendance
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
