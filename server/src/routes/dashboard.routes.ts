import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { startOfDayUTC } from "../services/attendance.service";

const router = Router();

router.get(
  "/admin",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const today = startOfDayUTC(new Date());
    const totalEmployees = await prisma.employee.count({ where: { status: "ACTIVE" } });

    const todayAttendance = await prisma.attendance.findMany({
      where: { date: today },
      include: { employee: { include: { department: true } } },
    });

    const present = todayAttendance.filter((a) => a.status === "PRESENT" || a.status === "HALF_DAY").length;
    const late = todayAttendance.filter((a) => a.status === "LATE").length;
    const onLeaveToday = todayAttendance.filter((a) => a.status === "ON_LEAVE").length;
    const presentEmployeeIds = new Set(todayAttendance.map((a) => a.employeeId));
    const absent = Math.max(0, totalEmployees - presentEmployeeIds.size);

    const upcomingHolidays = await prisma.holiday.findMany({
      where: { date: { gte: today }, isActive: true },
      orderBy: { date: "asc" },
      take: 5,
    });

    const upcomingLeaveRequests = await prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: { employee: true, leaveType: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const recentAttendance = await prisma.attendance.findMany({
      orderBy: { date: "desc" },
      take: 10,
      include: { employee: true },
    });

    // Attendance per month (last 6 months)
    const sixMonthsAgo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
    const attendanceLastSixMonths = await prisma.attendance.findMany({
      where: { date: { gte: sixMonthsAgo } },
      select: { date: true, status: true },
    });
    const attendanceByMonth: Record<string, { present: number; late: number; absent: number }> = {};
    for (const a of attendanceLastSixMonths) {
      const key = `${a.date.getUTCFullYear()}-${String(a.date.getUTCMonth() + 1).padStart(2, "0")}`;
      if (!attendanceByMonth[key]) attendanceByMonth[key] = { present: 0, late: 0, absent: 0 };
      if (a.status === "PRESENT" || a.status === "HALF_DAY") attendanceByMonth[key].present += 1;
      if (a.status === "LATE") attendanceByMonth[key].late += 1;
      if (a.status === "ABSENT") attendanceByMonth[key].absent += 1;
    }

    // Leave statistics by type
    const leaveByType = await prisma.leaveRequest.groupBy({
      by: ["leaveTypeId"],
      _sum: { totalDays: true },
      where: { status: "APPROVED" },
    });
    const leaveTypes = await prisma.leaveTypeModel.findMany();
    const leaveStatistics = leaveByType.map((l) => ({
      leaveType: leaveTypes.find((lt) => lt.id === l.leaveTypeId)?.name || "Unknown",
      totalDays: l._sum.totalDays || 0,
    }));

    // Working hours (last 7 days average)
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentHours = await prisma.attendance.findMany({
      where: { date: { gte: sevenDaysAgo }, totalHours: { gt: 0 } },
      select: { date: true, totalHours: true },
    });
    const hoursByDay: Record<string, number[]> = {};
    for (const r of recentHours) {
      const key = r.date.toISOString().slice(0, 10);
      if (!hoursByDay[key]) hoursByDay[key] = [];
      hoursByDay[key].push(r.totalHours);
    }
    const workingHoursTrend = Object.entries(hoursByDay).map(([date, hours]) => ({
      date,
      averageHours: Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 100) / 100,
    }));

    res.json({
      stats: {
        totalEmployees,
        present,
        absent,
        late,
        onLeave: onLeaveToday,
      },
      upcomingHolidays,
      upcomingLeaveRequests,
      recentAttendance,
      charts: {
        attendancePerMonth: Object.entries(attendanceByMonth).map(([month, v]) => ({ month, ...v })),
        lateEmployees: Object.entries(attendanceByMonth).map(([month, v]) => ({ month, late: v.late })),
        leaveStatistics,
        workingHoursTrend,
      },
    });
  })
);

router.get(
  "/employee",
  requireAuth,
  asyncHandler(async (req, res) => {
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new ApiError(400, "No employee profile linked to this account");

    const today = startOfDayUTC(new Date());
    const todayAttendance = await prisma.attendance.findUnique({ where: { employeeId_date: { employeeId, date: today } } });

    const startOfWeek = new Date(today);
    startOfWeek.setUTCDate(today.getUTCDate() - today.getUTCDay());
    const weekAttendance = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: startOfWeek } },
    });
    const weeklyHours = weekAttendance.reduce((s, a) => s + a.totalHours, 0);

    const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const monthAttendance = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: startOfMonth } },
    });
    const monthlyHours = monthAttendance.reduce((s, a) => s + a.totalHours, 0);

    const year = today.getUTCFullYear();
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: { leaveType: true },
    });

    const upcomingHolidays = await prisma.holiday.findMany({
      where: { date: { gte: today }, isActive: true },
      orderBy: { date: "asc" },
      take: 5,
    });

    res.json({
      todayAttendance,
      weeklyHours: Math.round(weeklyHours * 100) / 100,
      monthlyHours: Math.round(monthlyHours * 100) / 100,
      leaveBalances: leaveBalances.map((b) => ({ ...b, remainingDays: b.allocatedDays - b.usedDays })),
      upcomingHolidays,
    });
  })
);

export default router;
