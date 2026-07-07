import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { logAudit } from "../services/auditLog.service";
import { buildHolidaySeedForYear, payClassificationFor } from "../utils/phHolidays";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { year } = req.query as Record<string, string | undefined>;
    const where: any = { isActive: true };
    if (year) {
      const y = parseInt(year, 10);
      where.date = { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) };
    }
    const holidays = await prisma.holiday.findMany({ where, orderBy: { date: "asc" } });
    res.json(holidays);
  })
);

router.get(
  "/upcoming",
  requireAuth,
  asyncHandler(async (req, res) => {
    const today = new Date();
    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: today }, isActive: true },
      orderBy: { date: "asc" },
      take: 5,
    });
    res.json(holidays);
  })
);

const holidaySchema = z.object({
  name: z.string().min(1),
  date: z.string(),
  type: z.enum(["REGULAR", "SPECIAL_NON_WORKING", "SPECIAL_WORKING", "LOCAL"]),
  province: z.string().nullable().optional(),
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = holidaySchema.parse(req.body);
    const holiday = await prisma.holiday.create({
      data: {
        name: data.name,
        date: new Date(data.date),
        type: data.type,
        province: data.province,
        payClassification: payClassificationFor(data.type),
      },
    });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Holiday", entityId: holiday.id, details: "Created holiday", ipAddress: req.ip });
    res.status(201).json(holiday);
  })
);

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = holidaySchema.partial().parse(req.body);
    const holiday = await prisma.holiday.update({
      where: { id: req.params.id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.date ? { date: new Date(data.date) } : {}),
        ...(data.type ? { type: data.type, payClassification: payClassificationFor(data.type) } : {}),
        ...(data.province !== undefined ? { province: data.province } : {}),
      },
    });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Holiday", entityId: holiday.id, details: "Updated holiday", ipAddress: req.ip });
    res.json(holiday);
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await prisma.holiday.update({ where: { id: req.params.id }, data: { isActive: false } });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Holiday", entityId: req.params.id, details: "Deleted (deactivated) holiday", ipAddress: req.ip });
    res.json({ success: true });
  })
);

const syncSchema = z.object({ year: z.number().int().min(2000).max(2100) });

router.post(
  "/sync",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { year } = syncSchema.parse(req.body);
    const entries = buildHolidaySeedForYear(year);
    let created = 0;
    for (const entry of entries) {
      const result = await prisma.holiday.upsert({
        where: { name_date: { name: entry.name, date: entry.date } },
        update: {},
        create: entry,
      });
      if (result) created += 1;
    }
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Holiday", details: `Synced fixed PH holidays for ${year}`, ipAddress: req.ip });
    res.json({ success: true, count: created });
  })
);

export default router;
