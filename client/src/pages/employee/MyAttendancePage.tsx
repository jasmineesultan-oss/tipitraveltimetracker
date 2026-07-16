import { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { Attendance } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AttendanceCalendar } from "@/components/shared/AttendanceCalendar";
import { SelfAttendanceEntryDialog } from "@/components/shared/SelfAttendanceEntryDialog";
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
    setDialogOpen(true);
  }

  function openEditEntry(a: Attendance) {
    setEditingAttendance(a);
    setDialogOpen(true);
  }

  async function handleSaved() {
    setDialogOpen(false);
    await load();
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
          {!attendances ? (
            <PageSpinner />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Work Type</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Undertime</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Holiday</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {formatDate(a.date)}
                        {a.isManualEntry && <Badge variant="outline">Manual</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{formatTime(a.timeIn)}</TableCell>
                    <TableCell>{formatTime(a.timeOut)}</TableCell>
                    <TableCell>
                      <Badge variant={attendanceStatusVariant[a.status]}>{a.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={workTypeVariant[a.workType]}>{workTypeLabel[a.workType]}</Badge>
                    </TableCell>
                    <TableCell>{formatMinutes(a.lateMinutes)}</TableCell>
                    <TableCell>{formatMinutes(a.undertimeMinutes)}</TableCell>
                    <TableCell>{formatMinutes(a.overtimeMinutes)}</TableCell>
                    <TableCell>{a.totalHours}h</TableCell>
                    <TableCell>{a.holidayName || "—"}</TableCell>
                    <TableCell>
                      {toPhDateStr(a.date) < todayPhDateStr() && (
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => openEditEntry(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {attendances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-8 text-center text-slate-400">
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
        onSuccess={handleSaved}
      />
    </div>
  );
}
