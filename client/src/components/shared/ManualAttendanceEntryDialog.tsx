import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, apiErrorMessage } from "@/lib/api";
import type { Employee, WorkType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/shared/Alert";
import { workTypeLabel } from "@/lib/statusStyles";

interface ManualEntryFormValues {
  employeeId: string;
  date: string;
  timeIn?: string;
  timeOut?: string;
  workType: WorkType;
  notes?: string;
}

export function ManualAttendanceEntryDialog({
  open,
  onOpenChange,
  employees,
  onSaved,
  preselectedEmployeeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  onSaved: () => void;
  preselectedEmployeeId?: string;
}) {
  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<ManualEntryFormValues>();
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      reset({ employeeId: preselectedEmployeeId, date: "", timeIn: "", timeOut: "", workType: "OFFICE", notes: "" });
      setEmployeeSearch("");
      setError(null);
    }
  }, [open, preselectedEmployeeId, reset]);

  const filteredEmployees = employees.filter((e) => {
    const term = employeeSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(term) ||
      e.employeeCode.toLowerCase().includes(term) ||
      e.email.toLowerCase().includes(term)
    );
  });

  const preselectedEmployee = preselectedEmployeeId ? employees.find((e) => e.id === preselectedEmployeeId) : undefined;

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
            {preselectedEmployee ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                {preselectedEmployee.firstName} {preselectedEmployee.lastName} ({preselectedEmployee.employeeCode})
              </div>
            ) : (
              <>
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
              </>
            )}
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
