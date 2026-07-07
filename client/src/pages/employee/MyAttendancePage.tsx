import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { Attendance } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AttendanceCalendar } from "@/components/shared/AttendanceCalendar";
import { PageSpinner } from "@/components/shared/Spinner";
import { formatDate, formatTime, formatMinutes } from "@/lib/utils";
import { attendanceStatusVariant } from "@/lib/statusStyles";

export default function MyAttendancePage() {
  const { user } = useAuth();
  const [attendances, setAttendances] = useState<Attendance[] | null>(null);

  useEffect(() => {
    if (!user?.employee) return;
    api.get<Attendance[]>("/attendance", { params: { employeeId: user.employee.id } }).then((res) => setAttendances(res.data));
  }, [user]);

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
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
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
                  <TableHead>Late</TableHead>
                  <TableHead>Undertime</TableHead>
                  <TableHead>Overtime</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Holiday</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{formatDate(a.date)}</TableCell>
                    <TableCell>{formatTime(a.timeIn)}</TableCell>
                    <TableCell>{formatTime(a.timeOut)}</TableCell>
                    <TableCell>
                      <Badge variant={attendanceStatusVariant[a.status]}>{a.status.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>{formatMinutes(a.lateMinutes)}</TableCell>
                    <TableCell>{formatMinutes(a.undertimeMinutes)}</TableCell>
                    <TableCell>{formatMinutes(a.overtimeMinutes)}</TableCell>
                    <TableCell>{a.totalHours}h</TableCell>
                    <TableCell>{a.holidayName || "—"}</TableCell>
                  </TableRow>
                ))}
                {attendances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-slate-400">
                      No attendance records yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
