import { useEffect, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import type { Department, Employee, LeaveType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["PRESENT", "LATE", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY", "WEEKEND"];
const LEAVE_STATUS_OPTIONS = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

async function download(path: string, params: Record<string, unknown>, format: string, filename: string) {
  const res = await api.get(path, { params: { ...params, format }, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function ExportButtons({ onExport }: { onExport: (format: string) => void }) {
  return (
    <div className="flex gap-2">
      {["csv", "xlsx", "pdf"].map((fmt) => (
        <Button key={fmt} variant="outline" size="sm" onClick={() => onExport(fmt)}>
          <Download className="h-3.5 w-3.5" /> {fmt.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}

function AttendanceReportTab({ departments, employees }: { departments: Department[]; employees: Employee[] }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Report</CardTitle>
        <CardDescription>Covers daily, weekly, monthly, yearly, employee, department, late, undertime and absent reports via filters.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
          <div />
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input type="date" value={filters.startDate || ""} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input type="date" value={filters.endDate || ""} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
          </div>
        </div>
        <ExportButtons onExport={(fmt) => download("/reports/attendance", filters, fmt, "attendance-report")} />
      </CardContent>
    </Card>
  );
}

function LeaveReportTab({ departments, leaveTypes }: { departments: Department[]; leaveTypes: LeaveType[] }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Report</CardTitle>
        <CardDescription>Filter by department, leave type, status and date range.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
            <Label>Leave Type</Label>
            <Select value={filters.leaveTypeId} onValueChange={(v) => setFilters((f) => ({ ...f, leaveTypeId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((lt) => (
                  <SelectItem key={lt.id} value={lt.id}>
                    {lt.name}
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
                {LEAVE_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div />
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input type="date" value={filters.startDate || ""} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input type="date" value={filters.endDate || ""} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
          </div>
        </div>
        <ExportButtons onExport={(fmt) => download("/reports/leave", filters, fmt, "leave-report")} />
      </CardContent>
    </Card>
  );
}

function HolidayReportTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  return (
    <Card>
      <CardHeader>
        <CardTitle>Holiday Report</CardTitle>
        <CardDescription>Export the full holiday list for a given year.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-40 space-y-1">
          <Label>Year</Label>
          <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} />
        </div>
        <ExportButtons onExport={(fmt) => download("/reports/holidays", { year }, fmt, "holiday-report")} />
      </CardContent>
    </Card>
  );
}

function PayrollReportTab({ departments }: { departments: Department[] }) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payroll Summary / Working Hours / Overtime Report</CardTitle>
        <CardDescription>Per-employee summary of hours, overtime, lateness, undertime, absences and leave days.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
            <Label>Start Date</Label>
            <Input type="date" value={filters.startDate || ""} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input type="date" value={filters.endDate || ""} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
          </div>
        </div>
        <ExportButtons onExport={(fmt) => download("/reports/payroll-summary", filters, fmt, "payroll-summary")} />
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  useEffect(() => {
    api.get<Department[]>("/departments").then((res) => setDepartments(res.data));
    api.get<Employee[]>("/employees").then((res) => setEmployees(res.data));
    api.get<LeaveType[]>("/leave-types").then((res) => setLeaveTypes(res.data));
  }, []);

  const tabs = ["Attendance", "Leave", "Holidays", "Payroll Summary"];

  return (
    <Tabs.Root defaultValue="Attendance">
      <Tabs.List className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab}
            value={tab}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors",
              "data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            )}
          >
            {tab}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value="Attendance">
        <AttendanceReportTab departments={departments} employees={employees} />
      </Tabs.Content>
      <Tabs.Content value="Leave">
        <LeaveReportTab departments={departments} leaveTypes={leaveTypes} />
      </Tabs.Content>
      <Tabs.Content value="Holidays">
        <HolidayReportTab />
      </Tabs.Content>
      <Tabs.Content value="Payroll Summary">
        <PayrollReportTab departments={departments} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
