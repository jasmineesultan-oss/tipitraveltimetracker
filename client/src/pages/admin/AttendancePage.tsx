import { useEffect, useState } from "react";
import { PlusCircle, Trash2 } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { Attendance, Department, Employee } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSpinner } from "@/components/shared/Spinner";
import { Alert } from "@/components/shared/Alert";
import { ManualAttendanceEntryDialog } from "@/components/shared/ManualAttendanceEntryDialog";
import { formatDate, formatTime, formatMinutes } from "@/lib/utils";
import { attendanceStatusVariant, workTypeLabel, workTypeVariant } from "@/lib/statusStyles";

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY", "WEEKEND"];

function sessionSourceLabel(s: { manualEntryBy?: string | null }, employee?: Attendance["employee"]): string {
  if (s.manualEntryBy && employee?.userId && s.manualEntryBy === employee.userId) {
    return "Self-corrected by employee";
  }
  return "Entered by admin";
}

export default function AttendancePage() {
  const [attendances, setAttendances] = useState<Attendance[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filters, setFilters] = useState<{ departmentId?: string; employeeId?: string; status?: string; startDate?: string; endDate?: string }>({});
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Department[]>("/departments").then((res) => setDepartments(res.data));
    api.get<Employee[]>("/employees").then((res) => setEmployees(res.data));
  }, []);

  function load() {
    setAttendances(null);
    api
      .get<Attendance[]>("/attendance", {
        params: {
          departmentId: filters.departmentId,
          employeeId: filters.employeeId,
          status: filters.status,
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
      })
      .then((res) => setAttendances(res.data));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  async function deleteSession(sessionId: string) {
    if (!confirm("Delete this attendance entry? This cannot be undone.")) return;
    setError(null);
    try {
      await api.delete(`/attendance/session/${sessionId}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-5">
          <div className="space-y-1">
            <Label>Department</Label>
            <Select value={filters.departmentId} onValueChange={(v) => setFilters((f) => ({ ...f, departmentId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Employee</Label>
            <Select value={filters.employeeId} onValueChange={(v) => setFilters((f) => ({ ...f, employeeId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input type="date" value={filters.startDate || ""} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input type="date" value={filters.endDate || ""} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setManualEntryOpen(true)}>
          <PlusCircle className="h-4 w-4" /> Manual Entry
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      {!attendances ? (
        <PageSpinner />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
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
            {attendances.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="align-top font-medium text-slate-900">
                  {a.employee?.firstName} {a.employee?.lastName}
                </TableCell>
                <TableCell className="align-top">{a.employee?.department?.name || "—"}</TableCell>
                <TableCell className="align-top">{formatDate(a.date)}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1.5">
                    {(a.sessions || []).map((s) => (
                      <div key={s.id} className="flex items-center gap-1.5 text-xs">
                        <Badge variant={workTypeVariant[s.workType]}>{workTypeLabel[s.workType]}</Badge>
                        <span className="text-slate-600">
                          {formatTime(s.timeIn)} - {s.timeOut ? formatTime(s.timeOut) : "in progress"}
                        </span>
                        {s.isManualEntry && (
                          <Badge
                            variant={sessionSourceLabel(s, a.employee) === "Self-corrected by employee" ? "purple" : "outline"}
                            title={sessionSourceLabel(s, a.employee)}
                          >
                            {sessionSourceLabel(s, a.employee)}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Delete"
                          onClick={() => deleteSession(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    ))}
                    {(a.sessions || []).length === 0 && <span className="text-xs text-slate-400">No sessions</span>}
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
            ))}
            {attendances.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-slate-400">
                  No attendance records found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <ManualAttendanceEntryDialog open={manualEntryOpen} onOpenChange={setManualEntryOpen} employees={employees} onSaved={load} />
    </div>
  );
}
