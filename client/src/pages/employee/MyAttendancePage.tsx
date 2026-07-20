import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, apiErrorMessage } from "@/lib/api";
import type { Attendance, AttendanceSession } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AttendanceCalendar } from "@/components/shared/AttendanceCalendar";
import { SelfAttendanceEntryDialog } from "@/components/shared/SelfAttendanceEntryDialog";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";
import { formatDate, formatTime, formatMinutes, todayPhDateStr } from "@/lib/utils";
import { attendanceStatusVariant, workTypeLabel, workTypeVariant } from "@/lib/statusStyles";

function toPhDateStr(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(iso));
}

export default function MyAttendancePage() {
  const { user } = useAuth();
  const [attendances, setAttendances] = useState<Attendance[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | undefined>(undefined);
  const [editingSession, setEditingSession] = useState<AttendanceSession | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!user?.employee) return;
    const res = await api.get<Attendance[]>("/attendance", { params: { employeeId: user.employee.id } });
    setAttendances(res.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function openAddEntry() {
    setEditingAttendance(undefined);
    setEditingSession(undefined);
    setDialogOpen(true);
  }

  function openEditEntry(a: Attendance, s: AttendanceSession) {
    setEditingAttendance(a);
    setEditingSession(s);
    setDialogOpen(true);
  }

  async function handleSaved() {
    setDialogOpen(false);
    await load();
  }

  async function deleteSession(sessionId: string) {
    if (!confirm("Delete this attendance entry? This cannot be undone.")) return;
    setError(null);
    try {
      await api.delete(`/attendance/session/${sessionId}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (!user?.employee) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceCalendar employeeId={user.employee.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Attendance History</CardTitle>
          <Button onClick={openAddEntry}>
            <Plus className="h-4 w-4" /> Add Entry
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-3">
              <Alert>{error}</Alert>
            </div>
          )}
          {!attendances ? (
            <PageSpinner />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Undertime</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Holiday</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendances.map((a) => {
                  const isPast = toPhDateStr(a.date) < todayPhDateStr();
                  const sessions = a.sessions || [];
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="align-top">{formatDate(a.date)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          {sessions.map((s) => (
                            <div key={s.id} className="flex items-center gap-1.5 text-xs">
                              <Badge variant={workTypeVariant[s.workType]}>{workTypeLabel[s.workType]}</Badge>
                              <span className="text-slate-600">
                                {formatTime(s.timeIn)} - {s.timeOut ? formatTime(s.timeOut) : "in progress"}
                              </span>
                              {s.isManualEntry && <Badge variant="outline">Manual</Badge>}
                              {isPast && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    title="Edit"
                                    onClick={() => openEditEntry(a, s)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    title="Delete"
                                    onClick={() => deleteSession(s.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                  </Button>
                                </>
                              )}
                            </div>
                          ))}
                          {sessions.length === 0 && <span className="text-xs text-slate-400">No sessions</span>}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={attendanceStatusVariant[a.status]}>{a.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="align-top">{formatMinutes(a.undertimeMinutes)}</TableCell>
                      <TableCell className="align-top">{formatMinutes(a.overtimeMinutes)}</TableCell>
                      <TableCell className="align-top">{a.totalHours}h</TableCell>
                      <TableCell className="align-top">{a.holidayName || "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {attendances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-slate-400">
                      No attendance records yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <SelfAttendanceEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existing={editingAttendance}
        session={editingSession}
        onSuccess={handleSaved}
      />
    </div>
  );
}
