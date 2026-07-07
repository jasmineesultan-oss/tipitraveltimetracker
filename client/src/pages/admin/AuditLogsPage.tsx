import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { AuditLog } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageSpinner } from "@/components/shared/Spinner";
import { formatDate, formatTime } from "@/lib/utils";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);

  useEffect(() => {
    api.get<AuditLog[]>("/audit-logs").then((res) => setLogs(res.data));
  }, []);

  if (!logs) return <PageSpinner />;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Entity</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>IP Address</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell>{formatDate(log.createdAt)}</TableCell>
            <TableCell>{formatTime(log.createdAt)}</TableCell>
            <TableCell>
              {log.user?.employee ? `${log.user.employee.firstName} ${log.user.employee.lastName}` : log.user?.email || "System"}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{log.action.replace(/_/g, " ")}</Badge>
            </TableCell>
            <TableCell>{log.entityType || "—"}</TableCell>
            <TableCell className="max-w-xs truncate">{log.details || "—"}</TableCell>
            <TableCell>{log.ipAddress || "—"}</TableCell>
          </TableRow>
        ))}
        {logs.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="py-8 text-center text-slate-400">
              No audit log entries yet
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
