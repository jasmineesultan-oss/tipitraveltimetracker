import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { computeDayBreakdown, DayBreakdown } from "../services/payroll.service";
import { exportPayrollXlsx, exportReport, ExportColumn } from "../utils/export";

const router = Router();

function dateRangeFilter(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  const filter: any = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) filter.lte = new Date(endDate);
  return filter;
}

export interface EmployeePayrollBreakdown {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  days: DayBreakdown[];
  periodTotal: number;
}

async function computePayrollBreakdown(
  startDate: string | undefined,
  endDate: string | undefined,
  departmentId: string | undefined,
  employeeId: string | undefined
): Promise<{ employees: EmployeePayrollBreakdown[]; grandTotal: number }> {
  const employees = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      departmentId: departmentId || undefined,
      id: employeeId || undefined,
    },
    include: { department: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const results: EmployeePayrollBreakdown[] = [];
  let grandTotal = 0;

  for (const emp of employees) {
    const attendances = await prisma.attendance.findMany({
      where: { employeeId: emp.id, date: dateRangeFilter(startDate, endDate) },
      orderBy: { date: "asc" },
    });

    const days: DayBreakdown[] = [];
    for (const a of attendances) {
      const breakdown = await computeDayBreakdown(emp.id, a.date, {
        totalHours: a.totalHours,
        overtimeMinutes: a.overtimeMinutes,
        holidayType: a.holidayType,
      });
      days.push(breakdown);
    }

    const periodTotal = Math.round(days.reduce((s, d) => s + (d.dayTotal || 0), 0) * 100) / 100;
    grandTotal += periodTotal;

    results.push({
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      name: `${emp.firstName} ${emp.lastName}`,
      department: emp.department?.name || "",
      days,
      periodTotal,
    });
  }

  return { employees: results, grandTotal: Math.round(grandTotal * 100) / 100 };
}

router.get(
  "/breakdown",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, departmentId, employeeId } = req.query as Record<string, string | undefined>;
    const result = await computePayrollBreakdown(startDate, endDate, departmentId, employeeId);
    res.json(result);
  })
);

const PAYROLL_ESTIMATE_NOTE =
  "Estimated pay based on configured percentages (see Settings) - verify before use in actual payroll.";
const FLAT_EXPORT_NOTE = `${PAYROLL_ESTIMATE_NOTE} Formulas are only available in the Excel export - this file shows computed values.`;

const flatBreakdownColumns: ExportColumn[] = [
  { header: "Date", key: "date", width: 14 },
  { header: "Employee Code", key: "employeeCode", width: 15 },
  { header: "Name", key: "name", width: 22 },
  { header: "Hours Worked", key: "hoursWorked", width: 12 },
  { header: "Payable Hours", key: "payableHours", width: 12 },
  { header: "Hourly Rate", key: "hourlyRate", width: 12 },
  { header: "Holiday Type", key: "holidayType", width: 16 },
  { header: "Multiplier %", key: "multiplierPct", width: 12 },
  { header: "Base Amount", key: "baseAmount", width: 14 },
  { header: "Overtime Hours", key: "overtimeHours", width: 12 },
  { header: "Overtime Pay", key: "overtimePay", width: 14 },
  { header: "Day Total", key: "dayTotal", width: 14 },
];

function flattenBreakdown(employees: EmployeePayrollBreakdown[]) {
  const rows: Record<string, unknown>[] = [];
  for (const emp of employees) {
    for (const d of emp.days) {
      rows.push({
        date: d.date.toISOString().slice(0, 10),
        employeeCode: emp.employeeCode,
        name: emp.name,
        hoursWorked: d.hoursWorked,
        payableHours: d.payableHours,
        hourlyRate: d.hourlyRate ?? (d.note || ""),
        holidayType: d.holidayType || "—",
        multiplierPct: d.multiplierPct ?? "",
        baseAmount: d.baseAmount ?? "",
        overtimeHours: d.overtimeHours,
        overtimePay: d.overtimePay ?? "",
        dayTotal: d.dayTotal ?? "",
      });
    }
  }
  return rows;
}

router.get(
  "/export",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, departmentId, employeeId, format } = req.query as Record<string, string | undefined>;
    const { employees } = await computePayrollBreakdown(startDate, endDate, departmentId, employeeId);

    if ((format || "csv") === "xlsx") {
      await exportPayrollXlsx(res, "payroll", employees, PAYROLL_ESTIMATE_NOTE);
      return;
    }

    const rows = flattenBreakdown(employees);
    await exportReport(res, format || "csv", "payroll", "Payroll Breakdown", flatBreakdownColumns, rows, FLAT_EXPORT_NOTE);
  })
);

export default router;
