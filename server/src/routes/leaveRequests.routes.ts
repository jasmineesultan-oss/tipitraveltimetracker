import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { logAudit } from "../services/auditLog.service";
import { notify, notifyAllAdmins } from "../services/notification.service";
import { upload, uploadToBlob } from "../lib/upload";
import { startOfDayUTC, isWeekend, findHolidayForDate } from "../services/attendance.service";
import { stripDailyRate, type Viewer } from "../utils/employeeVisibility";

function viewerFrom(req: any): Viewer {
  return { role: req.user.role, employeeId: req.user.employeeId };
}

const router = Router();

function countLeaveDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(startOfDayUTC(start));
  const last = startOfDayUTC(end);
  while (cur.getTime() <= last.getTime()) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/**
 * Shared effects of approving a leave request: deduct the balance and mark the
 * affected weekdays as ON_LEAVE in attendance. Used both when an admin approves a
 * pending request and when an admin's own submission is auto-approved on creation.
 */
async function applyLeaveApprovalEffects(
  tx: Prisma.TransactionClient,
  leaveRequest: { employeeId: string; leaveTypeId: string; startDate: Date; endDate: Date; totalDays: number }
) {
  const year = leaveRequest.startDate.getUTCFullYear();
  const balance = await tx.leaveBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId: leaveRequest.employeeId, leaveTypeId: leaveRequest.leaveTypeId, year } },
  });
  if (balance) {
    await tx.leaveBalance.update({ where: { id: balance.id }, data: { usedDays: balance.usedDays + leaveRequest.totalDays } });
  }

  const cur = new Date(startOfDayUTC(leaveRequest.startDate));
  const last = startOfDayUTC(leaveRequest.endDate);
  while (cur.getTime() <= last.getTime()) {
    if (!isWeekend(cur)) {
      const holiday = await findHolidayForDate(cur);
      await tx.attendance.upsert({
        where: { employeeId_date: { employeeId: leaveRequest.employeeId, date: new Date(cur) } },
        update: { status: "ON_LEAVE" },
        create: {
          employeeId: leaveRequest.employeeId,
          date: new Date(cur),
          status: "ON_LEAVE",
          isWeekend: false,
          holidayId: holiday?.id ?? null,
          holidayType: holiday?.type ?? null,
          holidayName: holiday?.name ?? null,
        },
      });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { employeeId, status, leaveTypeId, startDate, endDate, departmentId } = req.query as Record<string, string | undefined>;
    if (req.user!.role !== "ADMIN" && employeeId && employeeId !== req.user!.employeeId) {
      throw new ApiError(403, "Forbidden");
    }
    const targetEmployeeId = req.user!.role === "ADMIN" ? employeeId : req.user!.employeeId;

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: targetEmployeeId || undefined,
        status: (status as any) || undefined,
        leaveTypeId: leaveTypeId || undefined,
        employee: departmentId ? { departmentId } : undefined,
        AND: [
          startDate ? { endDate: { gte: new Date(startDate) } } : {},
          endDate ? { startDate: { lte: new Date(endDate) } } : {},
        ],
      },
      include: { employee: { include: { department: true } }, leaveType: true, approvedBy: true },
      orderBy: { createdAt: "desc" },
    });
    const viewer = viewerFrom(req);
    res.json(
      leaveRequests.map((lr) => ({
        ...lr,
        employee: stripDailyRate(lr.employee, viewer),
        approvedBy: stripDailyRate(lr.approvedBy, viewer),
      }))
    );
  })
);

router.get(
  "/calendar",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { month, year, employeeId } = req.query as Record<string, string | undefined>;
    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getUTCFullYear();
    const m = month ? parseInt(month, 10) - 1 : now.getUTCMonth();

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: employeeId || undefined,
        startDate: { lt: new Date(Date.UTC(y, m + 1, 1)) },
        endDate: { gte: new Date(Date.UTC(y, m, 1)) },
        status: { not: "CANCELLED" },
      },
      include: { employee: true, leaveType: true },
    });
    const viewer = viewerFrom(req);
    res.json(leaveRequests.map((lr) => ({ ...lr, employee: stripDailyRate(lr.employee, viewer) })));
  })
);

const createLeaveSchema = z.object({
  employeeId: z.string().min(1).optional(),
  leaveTypeId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().min(1),
  isPlanned: z.boolean().optional(),
});

router.post(
  "/",
  requireAuth,
  upload.single("attachment"),
  asyncHandler(async (req, res) => {
    const data = createLeaveSchema.parse({
      ...req.body,
      isPlanned: req.body.isPlanned === "true" || req.body.isPlanned === true,
    });
    const employeeId = req.user!.role === "ADMIN" && data.employeeId ? data.employeeId : req.user!.employeeId;
    if (!employeeId) throw new ApiError(400, "No employee profile linked to this account");

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (endDate < startDate) throw new ApiError(400, "End date must be after start date");
    const totalDays = countLeaveDays(startDate, endDate);

    const leaveType = await prisma.leaveTypeModel.findUnique({ where: { id: data.leaveTypeId } });
    if (!leaveType) throw new ApiError(404, "Leave type not found");
    if (leaveType.requiresAttachment && !req.file) {
      throw new ApiError(400, `${leaveType.name} requires a supporting attachment`);
    }

    const attachmentUrl = req.file ? await uploadToBlob(req.file) : undefined;

    const isAdminSelfSubmission = req.user!.role === "ADMIN" && employeeId === req.user!.employeeId;

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: data.leaveTypeId,
        startDate,
        endDate,
        totalDays,
        reason: data.reason,
        attachmentUrl,
        isPlanned: data.isPlanned || false,
        ...(isAdminSelfSubmission
          ? { status: "APPROVED" as const, approvedById: employeeId, approvedAt: new Date() }
          : { status: "PENDING" as const }),
      },
      include: { employee: true, leaveType: true },
    });

    if (isAdminSelfSubmission) {
      await prisma.$transaction((tx) => applyLeaveApprovalEffects(tx, leaveRequest), { timeout: 15000 });
      await logAudit({ userId: req.user!.userId, action: "LEAVE_APPROVED", entityType: "LeaveRequest", entityId: leaveRequest.id, ipAddress: req.ip });
    } else {
      await logAudit({ userId: req.user!.userId, action: "LEAVE_SUBMITTED", entityType: "LeaveRequest", entityId: leaveRequest.id, ipAddress: req.ip });
      await notifyAllAdmins({
        type: "LEAVE_SUBMITTED",
        title: "New Leave Request",
        message: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName} submitted a ${leaveType.name} request.`,
        relatedEntityType: "LeaveRequest",
        relatedEntityId: leaveRequest.id,
      });
    }

    res.status(201).json(leaveRequest);
  })
);

router.put(
  "/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
    if (!leaveRequest) throw new ApiError(404, "Leave request not found");
    if (req.user!.role !== "ADMIN" && leaveRequest.employeeId !== req.user!.employeeId) {
      throw new ApiError(403, "Forbidden");
    }
    if (leaveRequest.status !== "PENDING") {
      throw new ApiError(400, "Only pending leave requests can be cancelled");
    }
    const updated = await prisma.leaveRequest.update({ where: { id: req.params.id }, data: { status: "CANCELLED" } });
    await logAudit({ userId: req.user!.userId, action: "LEAVE_CANCELLED", entityType: "LeaveRequest", entityId: updated.id, ipAddress: req.ip });
    res.json(updated);
  })
);

router.put(
  "/:id/approve",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: req.params.id },
      include: { employee: { include: { user: true } }, leaveType: true },
    });
    if (!leaveRequest) throw new ApiError(404, "Leave request not found");
    if (leaveRequest.status !== "PENDING") throw new ApiError(400, "Only pending leave requests can be approved");

    const approverEmployee = await prisma.employee.findUnique({ where: { userId: req.user!.userId } });

    const updated = await prisma.$transaction(async (tx) => {
      const lr = await tx.leaveRequest.update({
        where: { id: req.params.id },
        data: { status: "APPROVED", approvedById: approverEmployee?.id, approvedAt: new Date() },
      });
      await applyLeaveApprovalEffects(tx, leaveRequest);
      return lr;
    }, { timeout: 15000 });

    await logAudit({ userId: req.user!.userId, action: "LEAVE_APPROVED", entityType: "LeaveRequest", entityId: updated.id, ipAddress: req.ip });
    await notify({
      userId: leaveRequest.employee.user.id,
      type: "LEAVE_APPROVED",
      title: "Leave Request Approved",
      message: `Your ${leaveRequest.leaveType.name} request from ${leaveRequest.startDate.toDateString()} to ${leaveRequest.endDate.toDateString()} was approved.`,
      relatedEntityType: "LeaveRequest",
      relatedEntityId: updated.id,
    });

    res.json(updated);
  })
);

const rejectSchema = z.object({ rejectionReason: z.string().min(1) });

router.put(
  "/:id/reject",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { rejectionReason } = rejectSchema.parse(req.body);
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: req.params.id },
      include: { employee: { include: { user: true } }, leaveType: true },
    });
    if (!leaveRequest) throw new ApiError(404, "Leave request not found");
    if (leaveRequest.status !== "PENDING") throw new ApiError(400, "Only pending leave requests can be rejected");

    const approverEmployee = await prisma.employee.findUnique({ where: { userId: req.user!.userId } });
    const updated = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: { status: "REJECTED", rejectionReason, approvedById: approverEmployee?.id, approvedAt: new Date() },
    });

    await logAudit({ userId: req.user!.userId, action: "LEAVE_REJECTED", entityType: "LeaveRequest", entityId: updated.id, ipAddress: req.ip });
    await notify({
      userId: leaveRequest.employee.user.id,
      type: "LEAVE_REJECTED",
      title: "Leave Request Rejected",
      message: `Your ${leaveRequest.leaveType.name} request was rejected: ${rejectionReason}`,
      relatedEntityType: "LeaveRequest",
      relatedEntityId: updated.id,
    });

    res.json(updated);
  })
);

router.get(
  "/balances/:employeeId",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN" && req.user!.employeeId !== req.params.employeeId) {
      throw new ApiError(403, "Forbidden");
    }
    const year = req.query.year ? parseInt(req.query.year as string, 10) : new Date().getFullYear();
    const balances = await prisma.leaveBalance.findMany({
      where: { employeeId: req.params.employeeId, year },
      include: { leaveType: true },
    });
    res.json(
      balances.map((b) => ({
        ...b,
        remainingDays: b.allocatedDays - b.usedDays,
      }))
    );
  })
);

export default router;
