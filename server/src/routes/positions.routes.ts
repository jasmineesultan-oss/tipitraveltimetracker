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
    const positions = await prisma.position.findMany({
      include: { department: true, _count: { select: { employees: true } } },
      orderBy: { title: "asc" },
    });
    res.json(positions);
  })
);

const positionSchema = z.object({
  title: z.string().min(1),
  departmentId: z.string().min(1).nullable().optional(),
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = positionSchema.parse(req.body);
    const position = await prisma.position.create({ data });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Position", entityId: position.id, details: "Created position", ipAddress: req.ip });
    res.status(201).json(position);
  })
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = positionSchema.partial().parse(req.body);
    const position = await prisma.position.update({ where: { id: req.params.id }, data });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Position", entityId: position.id, details: "Updated position", ipAddress: req.ip });
    res.json(position);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const inUse = await prisma.employee.count({ where: { positionId: req.params.id } });
    if (inUse > 0) {
      throw new ApiError(400, "Cannot delete position with assigned employees");
    }
    await prisma.position.delete({ where: { id: req.params.id } });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Position", entityId: req.params.id, details: "Deleted position", ipAddress: req.ip });
    res.json({ success: true });
  })
);

export default router;
