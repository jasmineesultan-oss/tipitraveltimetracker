import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Search, Pencil, Trash2, Clock, UserX, UserCheck, Wallet } from "lucide-react";
import { getCoreRowModel, useReactTable, flexRender, createColumnHelper } from "@tanstack/react-table";
import { api, apiErrorMessage } from "@/lib/api";
import type { Department, Employee, EmploymentType, Gender, Position, RateHistory } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManualAttendanceEntryDialog } from "@/components/shared/ManualAttendanceEntryDialog";
import { formatDate, formatRate } from "@/lib/utils";

const UNSPECIFIED_GENDER = "unspecified";

function UpdateRateDialog({
  open,
  onOpenChange,
  employee,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onSaved: () => void;
}) {
  const [newRate, setNewRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<RateHistory[] | null>(null);

  useEffect(() => {
    if (open && employee) {
      setNewRate("");
      setEffectiveDate("");
      setError(null);
      setHistory(null);
      api
        .get<RateHistory[]>(`/employees/${employee.id}/rate-history`)
        .then((res) => setHistory(res.data))
        .catch(() => setHistory([]));
    }
  }, [open, employee]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.put(`/employees/${employee.id}/rate`, {
        newRate: parseFloat(newRate),
        effectiveDate: effectiveDate || undefined,
      });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Update Rate {employee ? `— ${employee.firstName} ${employee.lastName}` : ""}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          {error && <Alert>{error}</Alert>}
          <div className="space-y-1">
            <Label>Current Rate</Label>
            <p className="text-sm text-slate-500">{formatRate(employee?.hourlyRate)}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>New Rate</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Effective Date</Label>
              <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              Save Rate
            </Button>
          </DialogFooter>
        </form>

        <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
          <Label>Rate History</Label>
          {history === null ? (
            <p className="text-sm text-slate-400">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-400">No rate changes recorded yet.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>
                    {formatRate(h.oldRate)} → {formatRate(h.newRate)}
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(h.effectiveDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface EmployeeFormValues {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentId?: string;
  positionId?: string;
  hireDate?: string;
  role: "ADMIN" | "EMPLOYEE";
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  gender?: Gender | typeof UNSPECIFIED_GENDER;
  employmentType: EmploymentType;
}

function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  departments,
  positions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  departments: Department[];
  positions: Position[];
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<EmployeeFormValues>();
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTempPassword(null);
      setError(null);
      reset(
        employee
          ? {
              employeeCode: employee.employeeCode,
              firstName: employee.firstName,
              lastName: employee.lastName,
              email: employee.email,
              phone: employee.phone || "",
              departmentId: employee.departmentId || undefined,
              positionId: employee.positionId || undefined,
              hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : "",
              role: employee.role || "EMPLOYEE",
              scheduledStartTime: employee.scheduledStartTime || "",
              scheduledEndTime: employee.scheduledEndTime || "",
              gender: employee.gender || UNSPECIFIED_GENDER,
              employmentType: employee.employmentType || "REGULAR",
            }
          : { role: "EMPLOYEE", gender: UNSPECIFIED_GENDER, employmentType: "REGULAR" }
      );
    }
  }, [open, employee, reset]);

  async function onSubmit(values: EmployeeFormValues) {
    setError(null);
    const payload = {
      ...values,
      scheduledStartTime: values.scheduledStartTime || null,
      scheduledEndTime: values.scheduledEndTime || null,
      gender: values.gender === UNSPECIFIED_GENDER ? null : values.gender,
    };
    try {
      if (employee) {
        await api.put(`/employees/${employee.id}`, payload);
        onSaved();
        onOpenChange(false);
      } else {
        const { data } = await api.post("/employees", payload);
        if (data.temporaryPassword) {
          setTempPassword(data.temporaryPassword);
        } else {
          onSaved();
          onOpenChange(false);
        }
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee ? "Edit Employee" : "Add Employee"}</DialogTitle>
        </DialogHeader>
        {tempPassword ? (
          <div className="space-y-4">
            <Alert variant="success">
              Employee created. Temporary password: <strong>{tempPassword}</strong>
            </Alert>
            <DialogFooter>
              <Button
                onClick={() => {
                  onSaved();
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            {error && <Alert>{error}</Alert>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Employee Code</Label>
                <Input {...register("employeeCode", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={watch("role")} onValueChange={(v) => setValue("role", v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="ADMIN">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input {...register("firstName", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input {...register("lastName", { required: true })} />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label>Email</Label>
                <Input type="email" {...register("email", { required: true })} disabled={!!employee} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input {...register("phone")} />
              </div>
              <div className="space-y-1">
                <Label>Hire Date</Label>
                <Input type="date" {...register("hireDate")} />
              </div>
              <div className="space-y-1">
                <Label>Gender</Label>
                <Select value={watch("gender")} onValueChange={(v) => setValue("gender", v as EmployeeFormValues["gender"])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNSPECIFIED_GENDER}>Not specified</SelectItem>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Employment Type</Label>
                <Select
                  value={watch("employmentType")}
                  onValueChange={(v) => setValue("employmentType", v as EmploymentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REGULAR">Regular</SelectItem>
                    <SelectItem value="INTERN">Intern</SelectItem>
                    <SelectItem value="CONTRACTUAL">Contractual</SelectItem>
                    <SelectItem value="PROBATIONARY">Probationary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Select value={watch("departmentId")} onValueChange={(v) => setValue("departmentId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
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
                <Label>Position</Label>
                <Select value={watch("positionId")} onValueChange={(v) => setValue("positionId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Scheduled Start Time</Label>
                <Input type="time" {...register("scheduledStartTime")} />
              </div>
              <div className="space-y-1">
                <Label>Scheduled End Time</Label>
                <Input type="time" {...register("scheduledEndTime")} />
              </div>
              <p className="sm:col-span-2 -mt-1.5 text-xs text-slate-400">
                Leave blank to use the company default schedule.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formState.isSubmitting}>
                {employee ? "Save Changes" : "Create Employee"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logAttendanceOpen, setLogAttendanceOpen] = useState(false);
  const [logAttendanceEmployeeId, setLogAttendanceEmployeeId] = useState<string | null>(null);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [rateEmployee, setRateEmployee] = useState<Employee | null>(null);

  async function load() {
    const [empRes, deptRes, posRes] = await Promise.all([
      api.get<Employee[]>("/employees", { params: { search: search || undefined } }),
      api.get<Department[]>("/departments"),
      api.get<Position[]>("/positions"),
    ]);
    setEmployees(empRes.data);
    setDepartments(deptRes.data);
    setPositions(posRes.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this employee? This permanently deletes the account - use Deactivate instead if you might rehire them.")) return;
    setError(null);
    try {
      await api.delete(`/employees/${id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this employee? They won't be able to log in until reactivated.")) return;
    setError(null);
    try {
      await api.put(`/employees/${id}/deactivate`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleActivate(id: string) {
    setError(null);
    try {
      await api.put(`/employees/${id}/activate`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const columnHelper = createColumnHelper<Employee>();
  const columns = useMemo(
    () => [
      columnHelper.accessor("employeeCode", { header: "Code" }),
      columnHelper.display({
        id: "name",
        header: "Name",
        cell: (info) => `${info.row.original.firstName} ${info.row.original.lastName}`,
      }),
      columnHelper.accessor("email", { header: "Email" }),
      columnHelper.display({
        id: "department",
        header: "Department",
        cell: (info) => info.row.original.department?.name || "—",
      }),
      columnHelper.display({
        id: "position",
        header: "Position",
        cell: (info) => info.row.original.position?.title || "—",
      }),
      columnHelper.display({
        id: "hireDate",
        header: "Hire Date",
        cell: (info) => (info.row.original.hireDate ? formatDate(info.row.original.hireDate) : "—"),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <Badge variant={info.getValue() === "ACTIVE" ? "success" : "outline"}>{info.getValue()}</Badge>
        ),
      }),
      columnHelper.display({
        id: "hourlyRate",
        header: "Rate",
        cell: (info) => (info.row.original.employmentType === "INTERN" ? "N/A" : formatRate(info.row.original.hourlyRate)),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex justify-end gap-1">
            {info.row.original.employmentType !== "INTERN" && (
              <Button
                variant="ghost"
                size="icon"
                title="Update Rate"
                onClick={() => {
                  setRateEmployee(info.row.original);
                  setRateDialogOpen(true);
                }}
              >
                <Wallet className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              title="Log Attendance"
              onClick={() => {
                setLogAttendanceEmployeeId(info.row.original.id);
                setLogAttendanceOpen(true);
              }}
            >
              <Clock className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditingEmployee(info.row.original);
                setDialogOpen(true);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {info.row.original.status === "INACTIVE" ? (
              <Button variant="ghost" size="icon" title="Activate" onClick={() => handleActivate(info.row.original.id)}>
                <UserCheck className="h-4 w-4 text-emerald-600" />
              </Button>
            ) : (
              info.row.original.status !== "TERMINATED" && (
                <Button variant="ghost" size="icon" title="Deactivate" onClick={() => handleDeactivate(info.row.original.id)}>
                  <UserX className="h-4 w-4 text-amber-600" />
                </Button>
              )
            )}
            <Button variant="ghost" size="icon" onClick={() => handleDelete(info.row.original.id)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ),
      }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data: employees || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!employees) return <PageSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search employees..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button
          onClick={() => {
            setEditingEmployee(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
      </div>

      {error && <Alert>{error}</Alert>}

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
          {employees.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-slate-400">
                No employees found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <EmployeeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editingEmployee}
        departments={departments}
        positions={positions}
        onSaved={load}
      />

      <ManualAttendanceEntryDialog
        open={logAttendanceOpen}
        onOpenChange={setLogAttendanceOpen}
        employees={employees}
        onSaved={load}
        preselectedEmployeeId={logAttendanceEmployeeId ?? undefined}
      />

      <UpdateRateDialog open={rateDialogOpen} onOpenChange={setRateDialogOpen} employee={rateEmployee} onSaved={load} />
    </div>
  );
}
