import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { logAudit } from "../services/auditLog.service";

const router = Router();

function safeEmployee(employee: any) {
  if (!employee) return employee;
  const { user, ...rest } = employee;
  return { ...rest, email: rest.email, hasAccount: !!user, role: user?.role, isActive: user?.isActive };
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
    res.json(employees.map(safeEmployee));
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
    res.json(safeEmployee(employee));
  })
);

const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  hireDate: z.string().optional(),
  managerId: z.string().uuid().optional(),
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
  password: z.string().min(8).optional(),
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
        },
        include: { department: true, position: true, manager: true, user: true },
      });

      const leaveTypes = await tx.leaveTypeModel.findMany({ where: { isActive: true } });
      const year = new Date().getFullYear();
      await Promise.all(
        leaveTypes.map((lt) =>
          tx.leaveBalance.create({
            data: { employeeId: emp.id, leaveTypeId: lt.id, year, allocatedDays: lt.defaultDays, usedDays: 0 },
          })
        )
      );

      return emp;
    });

    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Employee", entityId: employee.id, details: "Created employee", ipAddress: req.ip });
    res.status(201).json({ ...safeEmployee(employee), temporaryPassword: data.password ? undefined : tempPassword });
  })
);

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  positionId: z.string().uuid().nullable().optional(),
  hireDate: z.string().optional(),
  managerId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED", "ON_LEAVE"]).optional(),
  profilePicture: z.string().nullable().optional(),
});

router.put(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    const data = updateEmployeeSchema.parse(req.body);
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { ...data, hireDate: data.hireDate ? new Date(data.hireDate) : undefined },
      include: { department: true, position: true, manager: true, user: true },
    });
    await logAudit({ userId: req.user!.userId, action: "ADMIN_ACTION", entityType: "Employee", entityId: employee.id, details: "Updated employee", ipAddress: req.ip });
    res.json(safeEmployee(employee));
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
    res.json(safeEmployee(employee));
  })
);

export default router;
