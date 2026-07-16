import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, apiErrorMessage } from "@/lib/api";
import type { Attendance, WorkType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert } from "@/components/shared/Alert";
import { workTypeLabel } from "@/lib/statusStyles";
import { maxCorrectionDate, phLocalToUtcIso, utcIsoToPhLocalTime } from "@/lib/utils";

interface SelfEntryFormValues {
  date: string;
  timeIn?: string;
  timeOut?: string;
  workType: WorkType;
  notes?: string;
}

function dateToPhDateStr(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(iso));
}

export function SelfAttendanceEntryDialog({
  open,
  onOpenChange,
  existing,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing?: Attendance;
  onSuccess: () => void;
}) {
  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<SelfEntryFormValues>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (existing) {
        reset({
          date: dateToPhDateStr(existing.date),
          timeIn: existing.timeIn ? utcIsoToPhLocalTime(existing.timeIn) : "",
          timeOut: existing.timeOut ? utcIsoToPhLocalTime(existing.timeOut) : "",
          workType: existing.workType,
          notes: existing.notes || "",
        });
      } else {
        reset({ date: "", timeIn: "", timeOut: "", workType: "OFFICE", notes: "" });
      }
      setError(null);
    }
  }, [open, existing, reset]);

  async function onSubmit(values: SelfEntryFormValues) {
    setError(null);
    try {
      await api.post("/attendance/self-correction", {
        date: values.date,
        timeIn: values.timeIn ? phLocalToUtcIso(values.date, values.timeIn) : undefined,
        timeOut: values.timeOut ? phLocalToUtcIso(values.date, values.timeOut) : undefined,
        workType: values.workType,
        notes: values.notes || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Attendance Entry" : "Log Past Attendance"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {error && <Alert>{error}</Alert>}
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" max={maxCorrectionDate()} disabled={!!existing} {...register("date", { required: true })} />
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
            <Textarea {...register("notes")} placeholder="e.g. Forgot to time out after client visit" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting || !watch("date")}>
              Save Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
