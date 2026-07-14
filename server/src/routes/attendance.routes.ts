import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { computeTimeIn, computeTimeOut, computeManualAttendanceFields, startOfDayUTC, toPhShifted } from "../services/attendance.service";
import { logAudit } from "../services/auditLog.service";
import { notifyAllAdmins, notify } from "../services/notification.service";

const router = Router();

async function resolveEmployeeId(req: any): Promise<string> {
  if (req.user.role === "ADMIN" && req.body.employeeId) return req.body.employeeId;
  if (!req.user.employeeId) throw new ApiError(400, "No employee profile linked to this account");
  return req.user.employeeId;
}

const workTypeEnum = z.enum(["OFFICE", "WORK_FROM_HOME", "FIELD_WORK"]);

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

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dayStart } },
    });
    if (existing?.timeIn) {
      throw new ApiError(400, "Already timed in today");
    }

    const computed = await computeTimeIn(employeeId, now);

    const attendance = existing
      ? await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            timeIn: now,
            ipAddress: req.ip,
            device: body.device,
            browser: body.browser,
            gpsLat: body.gpsLat,
            gpsLng: body.gpsLng,
            status: computed.status as any,
            lateMinutes: computed.lateMinutes,
            isWeekend: computed.isWeekend,
            holidayId: computed.holidayId,
            holidayType: computed.holidayType as any,
            holidayName: computed.holidayName,
            holidayPayClass: computed.holidayPayClass,
            workType: body.workType,
          },
        })
      : await prisma.attendance.create({
          data: {
            employeeId,
            date: dayStart,
            timeIn: now,
            ipAddress: req.ip,
            device: body.device,
            browser: body.browser,
            gpsLat: body.gpsLat,
            gpsLng: body.gpsLng,
            status: computed.status as any,
            lateMinutes: computed.lateMinutes,
            isWeekend: computed.isWeekend,
            holidayId: computed.holidayId,
            holidayType: computed.holidayType as any,
            holidayName: computed.holidayName,
            holidayPayClass: computed.holidayPayClass,
            workType: body.workType,
          },
        });

    await logAudit({ userId: req.user!.userId, action: "TIME_IN", entityType: "Attendance", entityId: attendance.id, ipAddress: req.ip });

    if (computed.lateMinutes > 0) {
      await notifyAllAdmins({
        type: "LATE_TODAY",
        title: "Employee Late Today",
        message: `Employee is late by ${computed.lateMinutes} minutes today.`,
        relatedEntityType: "Attendance",
        relatedEntityId: attendance.id,
      });
    }

    res.status(201).json(attendance);
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

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: dayStart } },
    });
    if (!existing || !existing.timeIn) {
      throw new ApiError(400, "You must time in before timing out");
    }
    if (existing.timeOut) {
      throw new ApiError(400, "Already timed out today");
    }

    const computed = await computeTimeOut(employeeId, existing.timeIn, now, body.breakHours || 0, existing.status);

    const attendance = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        timeOut: now,
        breakHours: body.breakHours || 0,
        totalHours: computed.totalHours,
        undertimeMinutes: computed.undertimeMinutes,
        overtimeMinutes: computed.overtimeMinutes,
        status: computed.status as any,
        ...(body.workType ? { workType: body.workType } : {}),
      },
    });

    await logAudit({ userId: req.user!.userId, action: "TIME_OUT", entityType: "Attendance", entityId: attendance.id, ipAddress: req.ip });
    res.json(attendance);
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
      include: { employee: { include: { department: true, position: true } } },
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

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: data.employeeId, date: dayStart } },
    });

    const timeInDate = data.timeIn ? new Date(data.timeIn) : existing?.timeIn ?? null;
    const timeOutDate = data.timeOut ? new Date(data.timeOut) : existing?.timeOut ?? null;

    const computedFields = await computeManualAttendanceFields(data.employeeId, timeInDate, timeOutDate);
    const fields: any = {
      workType: data.workType,
      notes: data.notes,
      isManualEntry: true,
      manualEntryBy: req.user!.userId,
      ...computedFields,
    };

    const attendance = existing
      ? await prisma.attendance.update({ where: { id: existing.id }, data: fields })
      : await prisma.attendance.create({
          data: { employeeId: data.employeeId, date: dayStart, ...fields },
        });

    await logAudit({
      userId: req.user!.userId,
      action: "ADMIN_ACTION",
      entityType: "Attendance",
      entityId: attendance.id,
      details: "Manual attendance entry",
      ipAddress: req.ip,
    });

    res.json(attendance);
  })
);

const selfCorrectionSchema = z.object({
  date: z.string().min(1),
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

    if (!data.timeIn && !data.timeOut) {
      throw new ApiError(400, "Provide at least a time in or time out");
    }

    const requestedDayStart = startOfDayUTC(new Date(data.date));
    const todayStart = startOfDayUTC(new Date());
    if (requestedDayStart.getTime() > todayStart.getTime()) {
      throw new ApiError(400, "Attendance corrections cannot be submitted for future dates");
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new ApiError(404, "Employee not found");

    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: requestedDayStart } },
    });

    const timeInDate = data.timeIn ? new Date(data.timeIn) : existing?.timeIn ?? null;
    const timeOutDate = data.timeOut ? new Date(data.timeOut) : existing?.timeOut ?? null;

    const computedFields = await computeManualAttendanceFields(employeeId, timeInDate, timeOutDate);
    const fields: any = {
      notes: data.notes,
      isManualEntry: true,
      manualEntryBy: req.user!.userId,
      ...(data.workType ? { workType: data.workType } : {}),
      ...computedFields,
    };

    const attendance = existing
      ? await prisma.attendance.update({ where: { id: existing.id }, data: fields })
      : await prisma.attendance.create({
          data: { employeeId, date: requestedDayStart, ...fields },
        });

    const dateLabel = requestedDayStart.toISOString().slice(0, 10);

    await logAudit({
      userId: req.user!.userId,
      action: "ATTENDANCE_SELF_CORRECTION",
      entityType: "Attendance",
      entityId: attendance.id,
      details: `Employee submitted a manual correction for ${dateLabel}`,
      ipAddress: req.ip,
    });

    await notifyAllAdmins({
      type: "ATTENDANCE_ANOMALY",
      title: "Attendance Self-Correction Submitted",
      message: `${employee.firstName} ${employee.lastName} submitted a manual attendance correction for ${dateLabel}.`,
      relatedEntityType: "Attendance",
      relatedEntityId: attendance.id,
    });

    res.json(attendance);
  })
);

router.post(
  "/check-missing-timeouts",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const today = startOfDayUTC(new Date());
    const missing = await prisma.attendance.findMany({
      where: { date: { lt: today }, timeIn: { not: null }, timeOut: null },
      include: { employee: { include: { user: true } } },
    });

    for (const record of missing) {
      await notify({
        userId: record.employee.user.id,
        type: "MISSING_TIME_OUT",
        title: "Missing Time Out",
        message: `You forgot to time out on ${record.date.toDateString()}.`,
        relatedEntityType: "Attendance",
        relatedEntityId: record.id,
      });
    }
    await notifyAllAdmins({
      type: "ATTENDANCE_ANOMALY",
      title: "Employees Forgot to Time Out",
      message: `${missing.length} attendance record(s) are missing a time out.`,
      relatedEntityType: "Attendance",
    });

    res.json({ flagged: missing.length });
  })
);

export default router;
