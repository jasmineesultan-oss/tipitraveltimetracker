import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { computeTimeIn, computeDayAggregate, startOfDayUTC, toPhShifted } from "../services/attendance.service";
import { logAudit } from "../services/auditLog.service";
import { notifyAllAdmins, notify } from "../services/notification.service";

const router = Router();

async function resolveEmployeeId(req: any): Promise<string> {
  if (req.user.role === "ADMIN" && req.body.employeeId) return req.body.employeeId;
  if (!req.user.employeeId) throw new ApiError(400, "No employee profile linked to this account");
  return req.user.employeeId;
}

const workTypeEnum = z.enum(["OFFICE", "WORK_FROM_HOME", "FIELD_WORK"]);

/** Day-level fields (calendar day, weekend/holiday, initial status) computed once per day, from its first session. */
function dayFieldsFrom(computed: Awaited<ReturnType<typeof computeTimeIn>>) {
  return {
    status: computed.status as any,
    isWeekend: computed.isWeekend,
    holidayId: computed.holidayId,
    holidayType: computed.holidayType as any,
    holidayName: computed.holidayName,
    holidayPayClass: computed.holidayPayClass,
  };
}

/** Recomputes and persists an Attendance row's aggregate totals from its sessions. */
async function refreshAttendanceAggregate(employeeId: string, attendanceId: string) {
  const aggregate = await computeDayAggregate(employeeId, attendanceId);
  return prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      totalHours: aggregate.totalHours,
      undertimeMinutes: aggregate.undertimeMinutes,
      overtimeMinutes: aggregate.overtimeMinutes,
      status: aggregate.status as any,
    },
    include: { sessions: { orderBy: { timeIn: "asc" } } },
  });
}

const timeInSchema = z.object({
  employeeId: z.string().min(1).optional(),
  device: z.string().optional(),
  browser: z.string().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  workType: workTypeEnum.optional().default("OFFICE"),
});

router.post(
  "/time-in",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = timeInSchema.parse(req.body);
    const employeeId = await resolveEmployeeId(req);
    const now = new Date();
    const dayStart = startOfDayUTC(now);

    let attendance = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dayStart } },
      include: { sessions: true },
    });

    if (attendance?.sessions.some((s) => !s.timeOut)) {
      throw new ApiError(400, "You're already timed in - please time out before starting a new entry");
    }

    const isFirstSessionToday = !attendance || attendance.sessions.length === 0;
    if (isFirstSessionToday) {
      const computed = await computeTimeIn(employeeId, now);
      const fields = dayFieldsFrom(computed);
      attendance = attendance
        ? await prisma.attendance.update({ where: { id: attendance.id }, data: fields, include: { sessions: true } })
        : await prisma.attendance.create({ data: { employeeId, date: dayStart, ...fields }, include: { sessions: true } });
    }

    await prisma.attendanceSession.create({
      data: {
        attendanceId: attendance!.id,
        timeIn: now,
        workType: body.workType,
        ipAddress: req.ip,
        device: body.device,
        browser: body.browser,
        gpsLat: body.gpsLat,
        gpsLng: body.gpsLng,
      },
    });

    await logAudit({ userId: req.user!.userId, action: "TIME_IN", entityType: "Attendance", entityId: attendance!.id, ipAddress: req.ip });

    const result = await prisma.attendance.findUnique({
      where: { id: attendance!.id },
      include: { sessions: { orderBy: { timeIn: "asc" } } },
    });

    res.status(201).json(result);
  })
);

const timeOutSchema = z.object({
  employeeId: z.string().min(1).optional(),
  breakHours: z.number().min(0).optional(),
  workType: workTypeEnum.optional(),
});

router.post(
  "/time-out",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = timeOutSchema.parse(req.body);
    const employeeId = await resolveEmployeeId(req);
    const now = new Date();
    const dayStart = startOfDayUTC(now);

    const attendance = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dayStart } },
      include: { sessions: true },
    });

    const openSession = attendance?.sessions
      .filter((s) => !s.timeOut)
      .sort((a, b) => b.timeIn.getTime() - a.timeIn.getTime())[0];

    if (!attendance || !openSession) {
      throw new ApiError(400, "You must time in before timing out");
    }

    await prisma.attendanceSession.update({
      where: { id: openSession.id },
      data: {
        timeOut: now,
        breakHours: body.breakHours || 0,
        ...(body.workType ? { workType: body.workType } : {}),
      },
    });

    const attendanceResult = await refreshAttendanceAggregate(employeeId, attendance.id);

    await logAudit({ userId: req.user!.userId, action: "TIME_OUT", entityType: "Attendance", entityId: attendance.id, ipAddress: req.ip });
    res.json(attendanceResult);
  })
);

router.get(
  "/today",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user!.employeeId) throw new ApiError(400, "No employee profile linked to this account");
    const dayStart = startOfDayUTC(new Date());
    const attendance = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: req.user!.employeeId, date: dayStart } },
      include: { sessions: { orderBy: { timeIn: "asc" } } },
    });
    res.json(attendance);
  })
);

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { employeeId, departmentId, startDate, endDate, status, month, year } = req.query as Record<string, string | undefined>;

    if (req.user!.role !== "ADMIN" && employeeId && employeeId !== req.user!.employeeId) {
      throw new ApiError(403, "Forbidden");
    }
    const targetEmployeeId = req.user!.role === "ADMIN" ? employeeId : req.user!.employeeId;

    let dateFilter: any = undefined;
    if (startDate || endDate) {
      dateFilter = {};
      if (startDate) dateFilter.gte = startOfDayUTC(new Date(startDate));
      if (endDate) dateFilter.lte = startOfDayUTC(new Date(endDate));
    } else if (month && year) {
      const m = parseInt(month, 10) - 1;
      const y = parseInt(year, 10);
      dateFilter = { gte: startOfDayUTC(new Date(Date.UTC(y, m, 1))), lt: startOfDayUTC(new Date(Date.UTC(y, m + 1, 1))) };
    } else if (year) {
      const y = parseInt(year, 10);
      dateFilter = { gte: startOfDayUTC(new Date(Date.UTC(y, 0, 1))), lt: startOfDayUTC(new Date(Date.UTC(y + 1, 0, 1))) };
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: targetEmployeeId || undefined,
        status: (status as any) || undefined,
        date: dateFilter,
        employee: departmentId ? { departmentId } : undefined,
      },
      include: {
        employee: { include: { department: true, position: true } },
        sessions: { orderBy: { timeIn: "asc" } },
      },
      orderBy: { date: "desc" },
    });
    res.json(attendances);
  })
);

router.get(
  "/calendar/:employeeId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN" && req.user!.employeeId !== req.params.employeeId) {
      throw new ApiError(403, "Forbidden");
    }
    const { month, year } = req.query as Record<string, string | undefined>;
    const nowPh = toPhShifted(new Date());
    const y = year ? parseInt(year, 10) : nowPh.getUTCFullYear();
    const m = month ? parseInt(month, 10) - 1 : nowPh.getUTCMonth();

    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: req.params.employeeId,
        date: { gte: startOfDayUTC(new Date(Date.UTC(y, m, 1))), lt: startOfDayUTC(new Date(Date.UTC(y, m + 1, 1))) },
      },
      include: { sessions: { orderBy: { timeIn: "asc" } } },
      orderBy: { date: "asc" },
    });
    res.json(attendances);
  })
);

router.post(
  "/:id/flag-anomaly",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const attendance = await prisma.attendance.findUnique({ where: { id: req.params.id }, include: { employee: { include: { user: true } } } });
    if (!attendance) throw new ApiError(404, "Attendance not found");
    await notify({
      userId: attendance.employee.user.id,
      type: "ATTENDANCE_ANOMALY",
      title: "Attendance Anomaly Flagged",
      message: req.body?.message || "An anomaly was flagged on your attendance record.",
      relatedEntityType: "Attendance",
      relatedEntityId: attendance.id,
    });
    res.json({ success: true });
  })
);

const manualEntrySchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  timeIn: z.string().optional(),
  timeOut: z.string().optional(),
  workType: workTypeEnum.optional().default("OFFICE"),
  notes: z.string().optional(),
});

router.post(
  "/manual-entry",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = manualEntrySchema.parse(req.body);
    const dayStart = startOfDayUTC(new Date(data.date));

    if (!data.sessionId && !data.timeIn) {
      throw new ApiError(400, "Time in is required to create a new session");
    }

    let attendance = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: data.employeeId, date: dayStart } },
      include: { sessions: true },
    });

    if (data.sessionId) {
      if (!attendance || !attendance.sessions.some((s) => s.id === data.sessionId)) {
        throw new ApiError(404, "Attendance session not found");
      }
      await prisma.attendanceSession.update({
        where: { id: data.sessionId },
        data: {
          ...(data.timeIn ? { timeIn: new Date(data.timeIn) } : {}),
          ...(data.timeOut ? { timeOut: new Date(data.timeOut) } : {}),
          workType: data.workType,
          notes: data.notes,
          isManualEntry: true,
          manualEntryBy: req.user!.userId,
        },
      });
    } else {
      const isFirstSessionToday = !attendance || attendance.sessions.length === 0;
      if (isFirstSessionToday) {
        const computed = await computeTimeIn(data.employeeId, new Date(data.timeIn!));
        const fields = dayFieldsFrom(computed);
        attendance = attendance
          ? await prisma.attendance.update({ where: { id: attendance.id }, data: fields, include: { sessions: true } })
          : await prisma.attendance.create({ data: { employeeId: data.employeeId, date: dayStart, ...fields }, include: { sessions: true } });
      }
      await prisma.attendanceSession.create({
        data: {
          attendanceId: attendance!.id,
          timeIn: new Date(data.timeIn!),
          timeOut: data.timeOut ? new Date(data.timeOut) : undefined,
          workType: data.workType,
          notes: data.notes,
          isManualEntry: true,
          manualEntryBy: req.user!.userId,
        },
      });
    }

    const updatedAttendance = await refreshAttendanceAggregate(data.employeeId, attendance!.id);

    await logAudit({
      userId: req.user!.userId,
      action: "ADMIN_ACTION",
      entityType: "Attendance",
      entityId: updatedAttendance.id,
      details: "Manual attendance entry",
      ipAddress: req.ip,
    });

    res.json(updatedAttendance);
  })
);

const selfCorrectionSchema = z.object({
  date: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  timeIn: z.string().optional(),
  timeOut: z.string().optional(),
  workType: workTypeEnum.optional(),
  notes: z.string().optional(),
});

router.post(
  "/self-correction",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = selfCorrectionSchema.parse(req.body);
    const employeeId = req.user!.employeeId;
    if (!employeeId) throw new ApiError(400, "No employee profile linked to this account");

    if (!data.sessionId && !data.timeIn) {
      throw new ApiError(400, "Provide a time in to log a new session");
    }

    const requestedDayStart = startOfDayUTC(new Date(data.date));
    const todayStart = startOfDayUTC(new Date());
    if (requestedDayStart.getTime() > todayStart.getTime()) {
      throw new ApiError(400, "Attendance corrections cannot be submitted for future dates");
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new ApiError(404, "Employee not found");

    let attendance = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: requestedDayStart } },
      include: { sessions: true },
    });

    if (data.sessionId) {
      if (!attendance || !attendance.sessions.some((s) => s.id === data.sessionId)) {
        throw new ApiError(404, "Attendance session not found");
      }
      await prisma.attendanceSession.update({
        where: { id: data.sessionId },
        data: {
          ...(data.timeIn ? { timeIn: new Date(data.timeIn) } : {}),
          ...(data.timeOut ? { timeOut: new Date(data.timeOut) } : {}),
          ...(data.workType ? { workType: data.workType } : {}),
          notes: data.notes,
          isManualEntry: true,
          manualEntryBy: req.user!.userId,
        },
      });
    } else {
      const isFirstSessionToday = !attendance || attendance.sessions.length === 0;
      if (isFirstSessionToday) {
        const computed = await computeTimeIn(employeeId, new Date(data.timeIn!));
        const fields = dayFieldsFrom(computed);
        attendance = attendance
          ? await prisma.attendance.update({ where: { id: attendance.id }, data: fields, include: { sessions: true } })
          : await prisma.attendance.create({ data: { employeeId, date: requestedDayStart, ...fields }, include: { sessions: true } });
      }
      await prisma.attendanceSession.create({
        data: {
          attendanceId: attendance!.id,
          timeIn: new Date(data.timeIn!),
          timeOut: data.timeOut ? new Date(data.timeOut) : undefined,
          workType: data.workType || "OFFICE",
          notes: data.notes,
          isManualEntry: true,
          manualEntryBy: req.user!.userId,
        },
      });
    }

    const updatedAttendance = await refreshAttendanceAggregate(employeeId, attendance!.id);
    const dateLabel = requestedDayStart.toISOString().slice(0, 10);

    await logAudit({
      userId: req.user!.userId,
      action: "ATTENDANCE_SELF_CORRECTION",
      entityType: "Attendance",
      entityId: updatedAttendance.id,
      details: `Employee submitted a manual correction for ${dateLabel}`,
      ipAddress: req.ip,
    });

    await notifyAllAdmins({
      type: "ATTENDANCE_ANOMALY",
      title: "Attendance Self-Correction Submitted",
      message: `${employee.firstName} ${employee.lastName} submitted a manual attendance correction for ${dateLabel}.`,
      relatedEntityType: "Attendance",
      relatedEntityId: updatedAttendance.id,
    });

    res.json(updatedAttendance);
  })
);

router.post(
  "/check-missing-timeouts",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const today = startOfDayUTC(new Date());
    const missingSessions = await prisma.attendanceSession.findMany({
      where: { timeOut: null, attendance: { date: { lt: today } } },
      include: { attendance: { include: { employee: { include: { user: true } } } } },
    });

    for (const session of missingSessions) {
      await notify({
        userId: session.attendance.employee.user.id,
        type: "MISSING_TIME_OUT",
        title: "Missing Time Out",
        message: `You forgot to time out on ${session.attendance.date.toDateString()}.`,
        relatedEntityType: "Attendance",
        relatedEntityId: session.attendance.id,
      });
    }
    await notifyAllAdmins({
      type: "ATTENDANCE_ANOMALY",
      title: "Employees Forgot to Time Out",
      message: `${missingSessions.length} attendance session(s) are missing a time out.`,
      relatedEntityType: "Attendance",
    });

    res.json({ flagged: missingSessions.length });
  })
);

export default router;
