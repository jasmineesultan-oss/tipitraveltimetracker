import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { getCoreRowModel, useReactTable, flexRender, createColumnHelper } from "@tanstack/react-table";
import { api, apiErrorMessage } from "@/lib/api";
import type { Department, Employee, Position } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

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
            }
          : { role: "EMPLOYEE" }
      );
    }
  }, [open, employee, reset]);

  async function onSubmit(values: EmployeeFormValues) {
    setError(null);
    try {
      if (employee) {
        await api.put(`/employees/${employee.id}`, values);
        onSaved();
        onOpenChange(false);
      } else {
        const { data } = await api.post("/employees", values);
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Employee Code</Label>
                <Input {...register("employeeCode", { required: true })} disabled={!!employee} />
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
              <div className="col-span-2 space-y-1">
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
    if (!confirm("Delete this employee? This cannot be undone.")) return;
    setError(null);
    try {
      await api.delete(`/employees/${id}`);
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
        id: "actions",
        header: "",
        cell: (info) => (
          <div className="flex justify-end gap-1">
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
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72">
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
    </div>
  );
}
