import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { PlusCircle } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { Attendance, Department, Employee, WorkType } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";
import { formatDate, formatTime, formatMinutes } from "@/lib/utils";
import { attendanceStatusVariant, workTypeLabel, workTypeVariant } from "@/lib/statusStyles";

const STATUS_OPTIONS = ["PRESENT", "LATE", "ABSENT", "HALF_DAY", "ON_LEAVE", "HOLIDAY", "WEEKEND"];

interface ManualEntryFormValues {
  employeeId: string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  workType: WorkType;
  notes?: string;
}

function ManualEntryDialog({
  open,
  onOpenChange,
  employees,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<ManualEntryFormValues>();
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      reset({ employeeId: undefined, date: "", timeIn: "", timeOut: "", workType: "OFFICE", notes: "" });
      setEmployeeSearch("");
      setError(null);
    }
  }, [open, reset]);

  const filteredEmployees = employees.filter((e) => {
    const term = employeeSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(term) ||
      e.employeeCode.toLowerCase().includes(term) ||
      e.email.toLowerCase().includes(term)
    );
  });

  async function onSubmit(values: ManualEntryFormValues) {
    setError(null);
    try {
      await api.post("/attendance/manual-entry", {
        employeeId: values.employeeId,
        date: values.date,
        timeIn: values.timeIn ? `${values.date}T${values.timeIn}:00.000Z` : undefined,
        timeOut: values.timeOut ? `${values.date}T${values.timeOut}:00.000Z` : undefined,
        workType: values.workType,
        notes: values.notes,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual Attendance Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {error && <Alert>{error}</Alert>}
          <div className="space-y-1">
            <Label>Employee</Label>
            <Input
              placeholder="Search by name, code, or email..."
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className="mb-1.5"
            />
            <Select value={watch("employeeId")} onValueChange={(v) => setValue("employeeId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {filteredEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} ({e.employeeCode})
                  </SelectItem>
                ))}
                {filteredEmployees.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-slate-400">No matches</div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" {...register("date", { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Time In</Label>
              <Input type="time" {...register("timeIn")} />
            </div>
            <div className="space-y-1">
              <Label>Time Out</Label>
              <Input type="time" {...register("timeOut")} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Work Type</Label>
            <Select value={watch("workType")} onValueChange={(v) => setValue("workType", v as WorkType)}>
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
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea {...register("notes")} placeholder="e.g. Forgot to time out, added manually" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting || !watch("employeeId")}>
              Save Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
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
                    {a.isManualEntry && <Badge variant="outline">Manual</Badge>}
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

      <ManualEntryDialog open={manualEntryOpen} onOpenChange={setManualEntryOpen} employees={employees} onSaved={load} />
    </div>
  );
}
