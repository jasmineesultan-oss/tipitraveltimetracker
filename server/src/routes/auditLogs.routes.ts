import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

router.get(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { userId, action, startDate, endDate } = req.query as Record<string, string | undefined>;
    const logs = await prisma.auditLog.findMany({
      where: {
        userId: userId || undefined,
        action: (action as any) || undefined,
        createdAt:
          startDate || endDate
            ? { gte: startDate ? new Date(startDate) : undefined, lte: endDate ? new Date(endDate) : undefined }
            : undefined,
      },
      include: { user: { include: { employee: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(logs);
  })
);

export default router;
