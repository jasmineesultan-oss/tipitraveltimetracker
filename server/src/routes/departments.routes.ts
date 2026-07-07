import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { logAudit } from "../services/auditLog.service";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const departments = await prisma.department.findMany({
      include: { _count: { select: { employees: true, positions: true } } },
      orderBy: { name: "asc" },
    });
    res.json(departments);
  })
);

const departmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = departmentSchema.parse(req.body);
    const department = await prisma.department.create({ data });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Department", entityId: department.id, details: "Created department", ipAddress: req.ip });
    res.status(201).json(department);
  })
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = departmentSchema.partial().parse(req.body);
    const department = await prisma.department.update({ where: { id: req.params.id }, data });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Department", entityId: department.id, details: "Updated department", ipAddress: req.ip });
    res.json(department);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const inUse = await prisma.employee.count({ where: { departmentId: req.params.id } });
    if (inUse > 0) {
      throw new ApiError(400, "Cannot delete department with assigned employees");
    }
    await prisma.department.delete({ where: { id: req.params.id } });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Department", entityId: req.params.id, details: "Deleted department", ipAddress: req.ip });
    res.json({ success: true });
  })
);

export default router;
