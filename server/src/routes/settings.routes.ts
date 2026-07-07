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
    const settings = await prisma.setting.findMany({ orderBy: { key: "asc" } });
    res.json(settings);
  })
);

const updateSchema = z.object({ value: z.string() });

router.put(
  "/:key",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { value } = updateSchema.parse(req.body);
    const setting = await prisma.setting.update({ where: { key: req.params.key }, data: { value } });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Setting", entityId: setting.id, details: `Updated ${setting.key}`, ipAddress: req.ip });
    res.json(setting);
  })
);

export default router;
