import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Paperclip } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, apiErrorMessage } from "@/lib/api";
import type { LeaveBalance, LeaveRequest, LeaveType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import { leaveStatusVariant } from "@/lib/statusStyles";

interface LeaveFormValues {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  isPlanned: boolean;
}

function LeaveRequestDialog({
  open,
  onOpenChange,
  leaveTypes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveTypes: LeaveType[];
  onSaved: (leaveRequest: LeaveRequest) => void;
}) {
  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<LeaveFormValues>();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      reset({ leaveTypeId: leaveTypes[0]?.id, startDate: "", endDate: "", reason: "", isPlanned: false });
      setFile(null);
      setError(null);
    }
  }, [open, leaveTypes, reset]);

  const selectedType = leaveTypes.find((lt) => lt.id === watch("leaveTypeId"));

  async function onSubmit(values: LeaveFormValues) {
    setError(null);
    try {
      const formData = new FormData();
      formData.append("leaveTypeId", values.leaveTypeId);
      formData.append("startDate", values.startDate);
      formData.append("endDate", values.endDate);
      formData.append("reason", values.reason);
      formData.append("isPlanned", String(values.isPlanned));
      if (file) formData.append("attachment", file);
      const res = await api.post<LeaveRequest>("/leave-requests", formData, { headers: { "Content-Type": "multipart/form-data" } });
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Leave Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {error && <Alert>{error}</Alert>}
          <div className="space-y-1">
            <Label>Leave Type</Label>
            <Select value={watch("leaveTypeId")} onValueChange={(v) => setValue("leaveTypeId", v)}>
              <SelectTrigger>
                <SelectValue />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" {...register("startDate", { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input type="date" {...register("endDate", { required: true })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Textarea {...register("reason", { required: true })} placeholder="Briefly explain the reason for leave" />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> Attachment {selectedType?.requiresAttachment && <span className="text-red-500">(required)</span>}
            </Label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register("isPlanned")} />
            Plot as planned leave (not yet a formal request)
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formState.isSubmitting}>
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MyLeavePage() {
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[] | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function load() {
    if (!user?.employee) return;
    const [lr, lt, bal] = await Promise.all([
      api.get<LeaveRequest[]>("/leave-requests", { params: { employeeId: user.employee.id } }),
      api.get<LeaveType[]>("/leave-types"),
      api.get<LeaveBalance[]>(`/leave-requests/balances/${user.employee.id}`),
    ]);
    setLeaveRequests(lr.data);
    setLeaveTypes(lt.data);
    setBalances(bal.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function cancelRequest(id: string) {
    if (!confirm("Cancel this leave request?")) return;
    setError(null);
    setSuccessMessage(null);
    try {
      await api.put(`/leave-requests/${id}/cancel`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function openRequestDialog() {
    setError(null);
    setSuccessMessage(null);
    setDialogOpen(true);
  }

  async function handleLeaveSaved(leaveRequest: LeaveRequest) {
    setSuccessMessage(
      leaveRequest.status === "APPROVED" ? "Leave approved and added to your calendar." : "Leave request submitted for approval."
    );
    await load();
  }

  if (!leaveRequests) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leave Balance</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {balances.map((b) => (
            <div key={b.id} className="rounded-lg border border-slate-100 p-3">
              <p className="text-xs text-slate-500">{b.leaveType.name}</p>
              <p className="text-lg font-semibold text-slate-900">{b.remainingDays}d</p>
              <p className="text-[11px] text-slate-400">of {b.allocatedDays}d allocated</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={openRequestDialog}>
          <Plus className="h-4 w-4" /> Request Leave
        </Button>
      </div>

      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {error && <Alert>{error}</Alert>}

      {leaveRequests.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white py-8 text-center text-slate-400">No leave requests yet</p>
      ) : (
        <>
          {/* Stacked cards on small screens */}
          <div className="space-y-3 sm:hidden">
            {leaveRequests.map((lr) => (
              <div key={lr.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{lr.leaveType.name}</p>
                  <Badge variant={leaveStatusVariant[lr.status]}>{lr.status}</Badge>
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Start</dt>
                    <dd className="text-slate-700">{formatDate(lr.startDate)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">End</dt>
                    <dd className="text-slate-700">{formatDate(lr.endDate)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Days</dt>
                    <dd className="text-slate-700">{lr.totalDays}</dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-slate-500">Reason</dt>
                    <dd className="text-slate-700">{lr.reason}</dd>
                  </div>
                </dl>
                {lr.status === "PENDING" && (
                  <div className="mt-2 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => cancelRequest(lr.id)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Table on sm and above */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((lr) => (
                  <TableRow key={lr.id}>
                    <TableCell className="font-medium text-slate-900">{lr.leaveType.name}</TableCell>
                    <TableCell>{formatDate(lr.startDate)}</TableCell>
                    <TableCell>{formatDate(lr.endDate)}</TableCell>
                    <TableCell>{lr.totalDays}</TableCell>
                    <TableCell className="max-w-xs truncate">{lr.reason}</TableCell>
                    <TableCell>
                      <Badge variant={leaveStatusVariant[lr.status]}>{lr.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {lr.status === "PENDING" && (
                        <Button variant="ghost" size="sm" onClick={() => cancelRequest(lr.id)}>
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <LeaveRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} leaveTypes={leaveTypes} onSaved={handleLeaveSaved} />
    </div>
  );
}
