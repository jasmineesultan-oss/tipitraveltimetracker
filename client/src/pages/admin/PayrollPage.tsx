import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { api } from "@/lib/api";
import type { Department, EmployeePayrollBreakdown, PayrollBreakdownResponse, PayrollDayBreakdown } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageSpinner } from "@/components/shared/Spinner";
import { formatDate, formatRate } from "@/lib/utils";

function currentMonthRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toStr = (d: Date) => d.toISOString().slice(0, 10);
  return { startDate: toStr(start), endDate: toStr(end) };
}

async function download(params: Record<string, unknown>, format: string) {
  const res = await api.get("/payroll/export", { params: { ...params, format }, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `payroll.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function dayFormulaText(d: PayrollDayBreakdown): string {
  if (d.hourlyRate === null) return d.note || "No rate on record";
  const rate = formatRate(d.hourlyRate);
  if (d.isHoliday) {
    return `${d.payableHours}h × ${rate} × ${d.multiplierPct}% = ₱${(d.holidayPay ?? 0).toFixed(2)}`;
  }
  let text = `${d.hoursWorked}h × ${rate} = ₱${(d.baseAmount ?? 0).toFixed(2)}`;
  if (d.overtimeHours > 0) {
    text += ` + ${d.overtimeHours}h OT × ${rate} × ${d.overtimePct}% = ₱${(d.overtimePay ?? 0).toFixed(2)}`;
  }
  return text;
}

function EmployeeRow({ emp }: { emp: EmployeePayrollBreakdown }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <TableCell>
          <div className="flex items-center gap-1.5">
            {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
            {emp.employeeCode}
          </div>
        </TableCell>
        <TableCell>{emp.name}</TableCell>
        <TableCell>{emp.department || "—"}</TableCell>
        <TableCell>{emp.days.length}</TableCell>
        <TableCell className="text-right font-semibold">₱{emp.periodTotal.toFixed(2)}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-slate-50 p-0">
            <div className="space-y-2 p-4">
              {emp.days.length === 0 ? (
                <p className="text-sm text-slate-400">No attendance records in this date range.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-400">
                      <th className="pb-1 pr-3">Date</th>
                      <th className="pb-1 pr-3">Hours</th>
                      <th className="pb-1 pr-3">Holiday</th>
                      <th className="pb-1 pr-3">Computation</th>
                      <th className="pb-1 text-right">Day Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.days.map((d) => (
                      <tr key={d.date} className="border-t border-slate-200">
                        <td className="py-1.5 pr-3 whitespace-nowrap">{formatDate(d.date)}</td>
                        <td className="py-1.5 pr-3">{d.hoursWorked}h</td>
                        <td className="py-1.5 pr-3">{d.holidayType || "—"}</td>
                        <td className="py-1.5 pr-3 text-slate-500">{dayFormulaText(d)}</td>
                        <td className="py-1.5 text-right font-medium">
                          {d.dayTotal === null ? "—" : `₱${d.dayTotal.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function PayrollPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<{ startDate: string; endDate: string; departmentId?: string }>(currentMonthRange());
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("xlsx");
  const [data, setData] = useState<PayrollBreakdownResponse | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get<Department[]>("/departments").then((res) => setDepartments(res.data));
  }, []);

  function load() {
    setData(null);
    api
      .get<PayrollBreakdownResponse>("/payroll/breakdown", {
        params: { startDate: filters.startDate, endDate: filters.endDate, departmentId: filters.departmentId },
      })
      .then((res) => setData(res.data));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.employees;
    return data.employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.employeeCode.toLowerCase().includes(q)
    );
  }, [data, search]);

  const visibleTotal = useMemo(
    () => Math.round(filteredEmployees.reduce((s, e) => s + e.periodTotal, 0) * 100) / 100,
    [filteredEmployees]
  );

  async function handleExport() {
    setExporting(true);
    try {
      await download({ startDate: filters.startDate, endDate: filters.endDate, departmentId: filters.departmentId }, format);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Payroll</CardTitle>
          <CardDescription>
            Fully transparent, formula-visible pay computation per employee. Figures are estimates based on
            configured percentages (see Settings) - verify before use in actual payroll.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
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
              <Label>Search Employee</Label>
              <Input placeholder="Name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Export Format</Label>
              <div className="flex gap-2">
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">Excel</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleExport} disabled={exporting}>
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!data ? (
        <PageSpinner />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead className="text-right">Period Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <EmployeeRow key={emp.employeeId} emp={emp} />
                ))}
                {filteredEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-slate-400">
                      No employees found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {filteredEmployees.length > 0 && (
              <div className="mt-3 flex justify-end border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900">
                Total: ₱{visibleTotal.toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
