import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { Holiday } from "@/types";
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
import { holidayTypeLabel } from "@/lib/statusStyles";

interface HolidayFormValues {
  name: string;
  date: string;
  type: "REGULAR" | "SPECIAL_NON_WORKING" | "SPECIAL_WORKING" | "LOCAL";
  province?: string;
}

function HolidayDialog({
  open,
  onOpenChange,
  holiday,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holiday: Holiday | null;
  onSaved: () => void;
}) {
  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<HolidayFormValues>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      reset(
        holiday
          ? { name: holiday.name, date: holiday.date.slice(0, 10), type: holiday.type, province: holiday.province || "" }
          : { name: "", date: "", type: "REGULAR", province: "" }
      );
    }
  }, [open, holiday, reset]);

  async function onSubmit(values: HolidayFormValues) {
    setError(null);
    try {
      if (holiday) await api.put(`/holidays/${holiday.id}`, values);
      else await api.post("/holidays", values);
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
          <DialogTitle>{holiday ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {error && <Alert>{error}</Alert>}
          <div className="space-y-1">
            <Label>Holiday Name</Label>
            <Input {...register("name", { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" {...register("date", { required: true })} />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={watch("type")} onValueChange={(v) => setValue("type", v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REGULAR">Regular Holiday</SelectItem>
                <SelectItem value="SPECIAL_NON_WORKING">Special Non-Working</SelectItem>
                <SelectItem value="SPECIAL_WORKING">Special Working</SelectItem>
                <SelectItem value="LOCAL">Local Holiday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Applicable Province/City (leave blank for nationwide)</Label>
            <Input {...register("province")} placeholder="e.g. Davao City" />
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

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    const { data } = await api.get<Holiday[]>("/holidays", { params: { year } });
    setHolidays(data);
  }

  useEffect(() => {
    setHolidays(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this holiday?")) return;
    setError(null);
    try {
      await api.delete(`/holidays/${id}`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await api.post("/holidays/sync", { year });
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="w-32 space-y-1">
          <Label>Year</Label>
          <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || year)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> Sync PH Holidays
          </Button>
          <Button
            onClick={() => {
              setEditingHoliday(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Holiday
          </Button>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {!holidays ? (
        <PageSpinner />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Province</TableHead>
              <TableHead>Pay Classification</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-medium text-slate-900">{h.name}</TableCell>
                <TableCell>{formatDate(h.date)}</TableCell>
                <TableCell>
                  <Badge variant="info">{holidayTypeLabel[h.type]}</Badge>
                </TableCell>
                <TableCell>{h.province || "Nationwide"}</TableCell>
                <TableCell className="max-w-sm text-xs text-slate-500">{h.payClassification}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingHoliday(h);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(h.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {holidays.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-slate-400">
                  No holidays for {year}. Try syncing PH holidays.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <HolidayDialog open={dialogOpen} onOpenChange={setDialogOpen} holiday={editingHoliday} onSaved={load} />
    </div>
  );
}
