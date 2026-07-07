import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { api, apiErrorMessage } from "@/lib/api";
import type { LeaveRequest } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/shared/Alert";
import { PageSpinner } from "@/components/shared/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { leaveStatusVariant } from "@/lib/statusStyles";

export default function LeaveRequestsPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[] | null>(null);
  const [status, setStatus] = useState<string | undefined>("PENDING");
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  async function load() {
    const lr = await api.get<LeaveRequest[]>("/leave-requests", { params: { status } });
    setLeaveRequests(lr.data);
  }

  useEffect(() => {
    setLeaveRequests(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function approve(id: string) {
    setError(null);
    try {
      await api.put(`/leave-requests/${id}/approve`);
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function reject() {
    if (!rejectTarget) return;
    setError(null);
    try {
      await api.put(`/leave-requests/${rejectTarget.id}/reject`, { rejectionReason });
      setRejectTarget(null);
      setRejectionReason("");
      load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="w-56 space-y-1">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v)}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {!leaveRequests ? (
        <PageSpinner />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Leave Type</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Attachment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveRequests.map((lr) => (
              <TableRow key={lr.id}>
                <TableCell className="font-medium text-slate-900">
                  {lr.employee?.firstName} {lr.employee?.lastName}
                </TableCell>
                <TableCell>{lr.leaveType.name}</TableCell>
                <TableCell>{formatDate(lr.startDate)}</TableCell>
                <TableCell>{formatDate(lr.endDate)}</TableCell>
                <TableCell>{lr.totalDays}</TableCell>
                <TableCell className="max-w-xs truncate">{lr.reason}</TableCell>
                <TableCell>
                  {lr.attachmentUrl ? (
                    <a href={lr.attachmentUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                      View
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={leaveStatusVariant[lr.status]}>{lr.status}</Badge>
                </TableCell>
                <TableCell>
                  {lr.status === "PENDING" && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => approve(lr.id)}>
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setRejectTarget(lr)}>
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {leaveRequests.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-slate-400">
                  No leave requests found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Rejection Reason</Label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Explain why this request is rejected" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reject} disabled={!rejectionReason.trim()}>
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
