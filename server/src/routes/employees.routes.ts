import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { logAudit } from "../services/auditLog.service";
import { notify } from "../services/notification.service";
import { stripHourlyRate, type Viewer } from "../utils/employeeVisibility";

const router = Router();

function viewerFrom(req: any): Viewer {
  return { role: req.user.role, employeeId: req.user.employeeId };
}

function safeEmployee(employee: any, viewer: Viewer) {
  if (!employee) return employee;
  const { user, manager, ...rest } = employee;
  const base = { ...rest, email: rest.email, hasAccount: !!user, role: user?.role, isActive: user?.isActive };
  return {
    ...stripHourlyRate(base, viewer),
    manager: manager ? stripHourlyRate(manager, viewer) : manager,
  };
}

router.get(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const { departmentId, status, search } = req.query as Record<string, string | undefined>;
    const employees = await prisma.employee.findMany({
      where: {
        departmentId: departmentId || undefined,
        status: (status as any) || undefined,
        OR: search
          ? [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { employeeCode: { contains: search, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: { department: true, position: true, manager: true, user: true },
      orderBy: { createdAt: "desc" },
    });
    const viewer = viewerFrom(req);
    res.json(employees.map((e) => safeEmployee(e, viewer)));
  })
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN" && req.user!.employeeId !== req.params.id) {
      throw new ApiError(403, "Forbidden");
    }
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: { department: true, position: true, manager: true, user: true },
    });
    if (!employee) throw new ApiError(404, "Employee not found");
    res.json(safeEmployee(employee, viewerFrom(req)));
  })
);

const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  departmentId: z.string().min(1).optional(),
  positionId: z.string().min(1).optional(),
  hireDate: z.string().optional(),
  managerId: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
  password: z.string().min(8).optional(),
  scheduledStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  scheduledEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  employmentType: z.enum(["REGULAR", "INTERN", "CONTRACTUAL", "PROBATIONARY"]).optional(),
});

router.post(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = createEmployeeSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ApiError(400, "A user with this email already exists");

    const tempPassword = data.password || `Tipi@${Math.floor(100000 + Math.random() * 900000)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email, passwordHash, role: data.role },
      });
      const emp = await tx.employee.create({
        data: {
          employeeCode: data.employeeCode,
          userId: user.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          departmentId: data.departmentId,
          positionId: data.positionId,
          hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
          managerId: data.managerId,
          scheduledStartTime: data.scheduledStartTime,
          scheduledEndTime: data.scheduledEndTime,
          gender: data.gender,
          employmentType: data.employmentType,
        },
        include: { department: true, position: true, manager: true, user: true },
      });

      const leaveTypes = await tx.leaveTypeModel.findMany({ where: { isActive: true } });
      const year = new Date().getFullYear();
      const applicableLeaveTypes = leaveTypes.filter(
        (lt) => !lt.applicableGender || lt.applicableGender === emp.gender
      );
      await tx.leaveBalance.createMany({
        data: applicableLeaveTypes.map((lt) => ({
          employeeId: emp.id,
          leaveTypeId: lt.id,
          year,
          allocatedDays: lt.defaultDays,
          usedDays: 0,
        })),
      });

      return emp;
    }, { timeout: 15000 });

    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Employee", entityId: employee.id, details: "Created employee", ipAddress: req.ip });
    res.status(201).json({ ...safeEmployee(employee, viewerFrom(req)), temporaryPassword: data.password ? undefined : tempPassword });
  })
);

const updateEmployeeSchema = z.object({
  employeeCode: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  departmentId: z.string().min(1).nullable().optional(),
  positionId: z.string().min(1).nullable().optional(),
  hireDate: z.string().optional(),
  managerId: z.string().min(1).nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED", "ON_LEAVE"]).optional(),
  profilePicture: z.string().nullable().optional(),
  scheduledStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  scheduledEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  employmentType: z.enum(["REGULAR", "INTERN", "CONTRACTUAL", "PROBATIONARY"]).optional(),
});

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateEmployeeSchema.parse(req.body);

    if (data.employeeCode) {
      const conflict = await prisma.employee.findFirst({
        where: { employeeCode: data.employeeCode, NOT: { id: req.params.id } },
      });
      if (conflict) throw new ApiError(400, "Employee code already in use");
    }

    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Employee not found");
    const becomingIntern = data.employmentType === "INTERN" && existing.employmentType !== "INTERN";
    const clearingRate = becomingIntern && existing.hourlyRate !== null;

    const employee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id: req.params.id },
        data: {
          ...data,
          hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
          hourlyRate: clearingRate ? null : undefined,
        },
        include: { department: true, position: true, manager: true, user: true },
      });
      if (clearingRate) {
        await tx.rateHistory.create({
          data: {
            employeeId: req.params.id,
            oldRate: existing.hourlyRate,
            newRate: null,
            changedBy: req.user!.userId,
            effectiveDate: new Date(),
          },
        });
      }
      return emp;
    });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Employee", entityId: employee.id, details: "Updated employee", ipAddress: req.ip });
    res.json(safeEmployee(employee, viewerFrom(req)));
  })
);

router.put(
  "/:id/deactivate",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Employee not found");

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { status: "INACTIVE", user: { update: { isActive: false } } },
      include: { department: true, position: true, manager: true, user: true },
    });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Employee", entityId: employee.id, details: "Deactivated employee", ipAddress: req.ip });
    res.json(safeEmployee(employee, viewerFrom(req)));
  })
);

router.put(
  "/:id/activate",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, "Employee not found");

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { status: "ACTIVE", user: { update: { isActive: true } } },
      include: { department: true, position: true, manager: true, user: true },
    });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Employee", entityId: employee.id, details: "Reactivated employee", ipAddress: req.ip });
    res.json(safeEmployee(employee, viewerFrom(req)));
  })
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) throw new ApiError(404, "Employee not found");
    await prisma.user.delete({ where: { id: employee.userId } });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Employee", entityId: req.params.id, details: "Deleted employee", ipAddress: req.ip });
    res.json({ success: true });
  })
);

const profileUpdateSchema = z.object({
  phone: z.string().optional(),
  profilePicture: z.string().nullable().optional(),
});

router.put(
  "/:id/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.employeeId !== req.params.id && req.user!.role !== "ADMIN") {
      throw new ApiError(403, "Forbidden");
    }
    const data = profileUpdateSchema.parse(req.body);
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data,
      include: { department: true, position: true, manager: true, user: true },
    });
    await logAudit({ userId: req.user!.userId, action: "PROFILE_UPDATED", entityType: "Employee", entityId: employee.id, ipAddress: req.ip });
    res.json(safeEmployee(employee, viewerFrom(req)));
  })
);

const updateRateSchema = z.object({
  newRate: z.number().positive(),
  effectiveDate: z.string().optional(),
});

router.put(
  "/:id/rate",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateRateSchema.parse(req.body);
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) throw new ApiError(404, "Employee not found");
    if (employee.employmentType === "INTERN") {
      throw new ApiError(400, "Interns are not eligible for a pay rate");
    }

    const oldRate = employee.hourlyRate;

    const updated = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id: req.params.id },
        data: { hourlyRate: data.newRate },
        include: { department: true, position: true, manager: true, user: true },
      });
      await tx.rateHistory.create({
        data: {
          employeeId: req.params.id,
          oldRate,
          newRate: data.newRate,
          changedBy: req.user!.userId,
          effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : new Date(),
        },
      });
      return emp;
    });

    if (oldRate !== null && data.newRate > oldRate) {
      await notify({
        userId: employee.userId,
        type: "GENERAL",
        title: "Rate Updated",
        message: "Your hourly rate has been updated. Check your profile for details.",
        relatedEntityType: "Employee",
        relatedEntityId: employee.id,
      });
    }

    await logAudit({
      userId: req.user!.userId,
      action: "ADMIN_ACTION",
      entityType: "Employee",
      entityId: employee.id,
      details: `Updated rate for ${employee.firstName} ${employee.lastName}`,
      ipAddress: req.ip,
    });

    res.json(safeEmployee(updated, viewerFrom(req)));
  })
);

router.get(
  "/:id/rate-history",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== "ADMIN" && req.user!.employeeId !== req.params.id) {
      throw new ApiError(403, "Forbidden");
    }
    const history = await prisma.rateHistory.findMany({
      where: { employeeId: req.params.id },
      orderBy: { effectiveDate: "desc" },
    });
    res.json(history);
  })
);

export default router;
