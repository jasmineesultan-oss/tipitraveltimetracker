import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Attendance, Department, Employee } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageSpinner } from "@/components/shared/Spinner";
import { formatDate, formatTime, formatMinutes } from "@/lib/utils";
import { attendanceStatusVariant } from "@/lib/statusStyles";

const STATUS_OPTIONS = ["PRESENT", "LATE", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY", "WEEKEND"];

export default function AttendancePage() {
  const [attendances, setAttendances] = useState<Attendance[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filters, setFilters] = useState<{ departmentId?: string; employeeId?: string; status?: string; startDate?: string; endDate?: string }>({});

  useEffect(() => {
    api.get<Department[]>("/departments").then((res) => setDepartments(res.data));
    api.get<Employee[]>("/employees").then((res) => setEmployees(res.data));
  }, []);

  useEffect(() => {
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
  }, [filters]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-5">
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
                  {a.employee?.firstName} {a.employee?.lastName}
                </TableCell>
                <TableCell>{a.employee?.department?.name || "—"}</TableCell>
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
                <TableCell colSpan={11} className="py-8 text-center text-slate-400">
                  No attendance records found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
