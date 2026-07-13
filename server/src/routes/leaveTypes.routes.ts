import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { logAudit } from "../services/auditLog.service";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const leaveTypes = await prisma.leaveTypeModel.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

    if (req.user!.role === "ADMIN") {
      return res.json(leaveTypes);
    }

    let employeeGender: string | null = null;
    if (req.user!.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: req.user!.employeeId },
        select: { gender: true },
      });
      employeeGender = employee?.gender ?? null;
    }

    const visibleLeaveTypes = leaveTypes.filter((lt) => !lt.applicableGender || lt.applicableGender === employeeGender);
    res.json(visibleLeaveTypes);
  })
);

const leaveTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  defaultDays: z.number().min(0),
  requiresAttachment: z.boolean().optional(),
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = leaveTypeSchema.parse(req.body);
    const leaveType = await prisma.leaveTypeModel.create({ data });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "LeaveType", entityId: leaveType.id, details: "Created leave type", ipAddress: req.ip });
    res.status(201).json(leaveType);
  })
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = leaveTypeSchema.partial().parse(req.body);
    const leaveType = await prisma.leaveTypeModel.update({ where: { id: req.params.id }, data });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "LeaveType", entityId: leaveType.id, details: "Updated leave type", ipAddress: req.ip });
    res.json(leaveType);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await prisma.leaveTypeModel.update({ where: { id: req.params.id }, data: { isActive: false } });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "LeaveType", entityId: req.params.id, details: "Deactivated leave type", ipAddress: req.ip });
    res.json({ success: true });
  })
);

export default router;
