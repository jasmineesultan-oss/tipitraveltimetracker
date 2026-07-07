import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { exportReport, ExportColumn } from "../utils/export";

const router = Router();

function dateRangeFilter(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return undefined;
  const filter: any = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate) filter.lte = new Date(endDate);
  return filter;
}

const attendanceColumns: ExportColumn[] = [
  { header: "Employee Code", key: "employeeCode", width: 15 },
  { header: "Name", key: "name", width: 22 },
  { header: "Department", key: "department", width: 18 },
  { header: "Date", key: "date", width: 14 },
  { header: "Time In", key: "timeIn", width: 14 },
  { header: "Time Out", key: "timeOut", width: 14 },
  { header: "Status", key: "status", width: 12 },
  { header: "Late (min)", key: "lateMinutes", width: 10 },
  { header: "Undertime (min)", key: "undertimeMinutes", width: 12 },
  { header: "Overtime (min)", key: "overtimeMinutes", width: 12 },
  { header: "Total Hours", key: "totalHours", width: 10 },
  { header: "Holiday", key: "holidayName", width: 18 },
];

function mapAttendanceRow(a: any) {
  return {
    employeeCode: a.employee.employeeCode,
    name: `${a.employee.firstName} ${a.employee.lastName}`,
    department: a.employee.department?.name || "",
    date: a.date.toISOString().slice(0, 10),
    timeIn: a.timeIn ? new Date(a.timeIn).toISOString().slice(11, 16) : "",
    timeOut: a.timeOut ? new Date(a.timeOut).toISOString().slice(11, 16) : "",
    status: a.status,
    lateMinutes: a.lateMinutes,
    undertimeMinutes: a.undertimeMinutes,
    overtimeMinutes: a.overtimeMinutes,
    totalHours: a.totalHours,
    holidayName: a.holidayName || "",
  };
}

/**
 * Covers Daily/Weekly/Monthly/Yearly/Employee/Department/Late/Undertime/Absent/
 * Working-Hours/Overtime reports via query filters on a shared attendance dataset.
 */
router.get(
  "/attendance",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, employeeId, departmentId, status, format } = req.query as Record<string, string | undefined>;
    const attendances = await prisma.attendance.findMany({
      where: {
        date: dateRangeFilter(startDate, endDate),
        employeeId: employeeId || undefined,
        status: (status as any) || undefined,
        employee: departmentId ? { departmentId } : undefined,
      },
      include: { employee: { include: { department: true } } },
      orderBy: { date: "asc" },
    });
    await exportReport(res, format || "csv", "attendance-report", "Attendance Report", attendanceColumns, attendances.map(mapAttendanceRow));
  })
);

const leaveColumns: ExportColumn[] = [
  { header: "Employee Code", key: "employeeCode", width: 15 },
  { header: "Name", key: "name", width: 22 },
  { header: "Department", key: "department", width: 18 },
  { header: "Leave Type", key: "leaveType", width: 18 },
  { header: "Start Date", key: "startDate", width: 14 },
  { header: "End Date", key: "endDate", width: 14 },
  { header: "Total Days", key: "totalDays", width: 10 },
  { header: "Status", key: "status", width: 12 },
  { header: "Reason", key: "reason", width: 30 },
];

router.get(
  "/leave",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, employeeId, departmentId, leaveTypeId, status, format } = req.query as Record<string, string | undefined>;
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: employeeId || undefined,
        leaveTypeId: leaveTypeId || undefined,
        status: (status as any) || undefined,
        employee: departmentId ? { departmentId } : undefined,
        AND: [
          startDate ? { endDate: { gte: new Date(startDate) } } : {},
          endDate ? { startDate: { lte: new Date(endDate) } } : {},
        ],
      },
      include: { employee: { include: { department: true } }, leaveType: true },
      orderBy: { startDate: "asc" },
    });
    const rows = leaveRequests.map((l) => ({
      employeeCode: l.employee.employeeCode,
      name: `${l.employee.firstName} ${l.employee.lastName}`,
      department: l.employee.department?.name || "",
      leaveType: l.leaveType.name,
      startDate: l.startDate.toISOString().slice(0, 10),
      endDate: l.endDate.toISOString().slice(0, 10),
      totalDays: l.totalDays,
      status: l.status,
      reason: l.reason,
    }));
    await exportReport(res, format || "csv", "leave-report", "Leave Report", leaveColumns, rows);
  })
);

const holidayColumns: ExportColumn[] = [
  { header: "Name", key: "name", width: 25 },
  { header: "Date", key: "date", width: 14 },
  { header: "Type", key: "type", width: 18 },
  { header: "Province", key: "province", width: 18 },
  { header: "Pay Classification", key: "payClassification", width: 40 },
];

router.get(
  "/holidays",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { year, format } = req.query as Record<string, string | undefined>;
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) }, isActive: true },
      orderBy: { date: "asc" },
    });
    const rows = holidays.map((h) => ({
      name: h.name,
      date: h.date.toISOString().slice(0, 10),
      type: h.type,
      province: h.province || "Nationwide",
      payClassification: h.payClassification,
    }));
    await exportReport(res, format || "csv", "holiday-report", "Holiday Report", holidayColumns, rows);
  })
);

const payrollColumns: ExportColumn[] = [
  { header: "Employee Code", key: "employeeCode", width: 15 },
  { header: "Name", key: "name", width: 22 },
  { header: "Department", key: "department", width: 18 },
  { header: "Days Present", key: "daysPresent", width: 12 },
  { header: "Total Hours", key: "totalHours", width: 12 },
  { header: "Overtime (hrs)", key: "overtimeHours", width: 12 },
  { header: "Late (min)", key: "lateMinutes", width: 10 },
  { header: "Undertime (min)", key: "undertimeMinutes", width: 12 },
  { header: "Absences", key: "absences", width: 10 },
  { header: "Approved Leave Days", key: "leaveDays", width: 15 },
];

router.get(
  "/payroll-summary",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, departmentId, format } = req.query as Record<string, string | undefined>;
    const employees = await prisma.employee.findMany({
      where: { status: "ACTIVE", departmentId: departmentId || undefined },
      include: { department: true },
    });

    const rows = await Promise.all(
      employees.map(async (emp) => {
        const attendances = await prisma.attendance.findMany({
          where: { employeeId: emp.id, date: dateRangeFilter(startDate, endDate) },
        });
        const daysPresent = attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE" || a.status === "HALF_DAY").length;
        const totalHours = attendances.reduce((s, a) => s + a.totalHours, 0);
        const overtimeMinutes = attendances.reduce((s, a) => s + a.overtimeMinutes, 0);
        const lateMinutes = attendances.reduce((s, a) => s + a.lateMinutes, 0);
        const undertimeMinutes = attendances.reduce((s, a) => s + a.undertimeMinutes, 0);
        const absences = attendances.filter((a) => a.status === "ABSENT").length;
        const leaveDays = attendances.filter((a) => a.status === "ON_LEAVE").length;

        return {
          employeeCode: emp.employeeCode,
          name: `${emp.firstName} ${emp.lastName}`,
          department: emp.department?.name || "",
          daysPresent,
          totalHours: Math.round(totalHours * 100) / 100,
          overtimeHours: Math.round((overtimeMinutes / 60) * 100) / 100,
          lateMinutes,
          undertimeMinutes,
          absences,
          leaveDays,
        };
      })
    );

    await exportReport(res, format || "csv", "payroll-summary", "Payroll Summary Report", payrollColumns, rows);
  })
);

export default router;
