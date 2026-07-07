import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2 } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { api, apiErrorMessage } from "@/lib/api";
import type { Department, Position } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function DepartmentDialog({
  open,
  onOpenChange,
  department,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, formState } = useForm<{ name: string; code: string; description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) reset(department ? { name: department.name, code: department.code, description: department.description || "" } : { name: "", code: "", description: "" });
  }, [open, department, reset]);

  async function onSubmit(values: { name: string; code: string; description?: string }) {
    setError(null);
    try {
      if (department) await api.put(`/departments/${department.id}`, values);
      else await api.post("/departments", values);
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
          <DialogTitle>{department ? "Edit Department" : "Add Department"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {error && <Alert>{error}</Alert>}
          <div className="space-y-1">
            <Label>Name</Label>
            <Input {...register("name", { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>Code</Label>
            <Input {...register("code", { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PositionDialog({
  open,
  onOpenChange,
  position,
  departments,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: Position | null;
  departments: Department[];
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<{ title: string; departmentId?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) reset(position ? { title: position.title, departmentId: position.departmentId || undefined } : { title: "" });
  }, [open, position, reset]);

  async function onSubmit(values: { title: string; departmentId?: string }) {
    setError(null);
    try {
      if (position) await api.put(`/positions/${position.id}`, values);
      else await api.post("/positions", values);
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
          <DialogTitle>{position ? "Edit Position" : "Add Position"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {error && <Alert>{error}</Alert>}
          <div className="space-y-1">
            <Label>Title</Label>
            <Input {...register("title", { required: true })} />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);

  async function load() {
    const [d, p] = await Promise.all([api.get<Department[]>("/departments"), api.get<Position[]>("/positions")]);
    setDepartments(d.data);
    setPositions(p.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteDepartment(id: string) {
    if (!confirm("Delete this department?")) return;
    setError(null);
    try {
      await api.delete(`/departments/${id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function deletePosition(id: string) {
    if (!confirm("Delete this position?")) return;
    setError(null);
    try {
      await api.delete(`/positions/${id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  if (!departments || !positions) return <PageSpinner />;

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Tabs.Root defaultValue="departments">
        <Tabs.List className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          {["departments", "positions"].map((tab) => (
            <Tabs.Trigger
              key={tab}
              value={tab}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium capitalize text-slate-600 transition-colors",
                "data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
              )}
            >
              {tab}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="departments" className="space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingDept(null);
                setDeptDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Department
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-slate-900">{d.name}</TableCell>
                  <TableCell>{d.code}</TableCell>
                  <TableCell>{d.description || "—"}</TableCell>
                  <TableCell>{d._count?.employees ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingDept(d);
                          setDeptDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteDepartment(d.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Tabs.Content>

        <Tabs.Content value="positions" className="space-y-3">
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingPos(null);
                setPosDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add Position
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-slate-900">{p.title}</TableCell>
                  <TableCell>{p.department?.name || "—"}</TableCell>
                  <TableCell>{p._count?.employees ?? 0}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingPos(p);
                          setPosDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deletePosition(p.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Tabs.Content>
      </Tabs.Root>

      <DepartmentDialog open={deptDialogOpen} onOpenChange={setDeptDialogOpen} department={editingDept} onSaved={load} />
      <PositionDialog open={posDialogOpen} onOpenChange={setPosDialogOpen} position={editingPos} departments={departments} onSaved={load} />
    </div>
  );
}
