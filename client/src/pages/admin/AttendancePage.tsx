import { useEffect, useState } from "react";
import { PlusCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { Attendance, Department, Employee } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSpinner } from "@/components/shared/Spinner";
import { ManualAttendanceEntryDialog } from "@/components/shared/ManualAttendanceEntryDialog";
import { formatDate, formatTime, formatMinutes } from "@/lib/utils";
import { attendanceStatusVariant, workTypeLabel, workTypeVariant } from "@/lib/statusStyles";

const STATUS_OPTIONS = ["PRESENT", "LATE", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY", "WEEKEND"];

function manualEntrySourceLabel(a: Attendance): string {
  if (a.manualEntryBy && a.employee?.userId && a.manualEntryBy === a.employee.userId) {
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

      {!attendances ? (
        <PageSpinner />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {attendances.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-slate-900">
                  <div className="flex items-center gap-1.5">
                    {a.employee?.firstName} {a.employee?.lastName}
                    {a.isManualEntry && (
                      <Badge
                        variant={manualEntrySourceLabel(a) === "Self-corrected by employee" ? "purple" : "outline"}
                        title={manualEntrySourceLabel(a)}
                      >
                        {manualEntrySourceLabel(a)}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{a.employee?.department?.name || "—"}</TableCell>
                <TableCell>{formatDate(a.date)}</TableCell>
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
              </TableRow>
            ))}
            {attendances.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="py-8 text-center text-slate-400">
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
