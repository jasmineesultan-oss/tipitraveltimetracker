import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../utils/jwt";
import { asyncHandler, ApiError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/auth";
import { logAudit } from "../services/auditLog.service";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password, rememberMe } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email }, include: { employee: true } });
    if (!user || !user.isActive) {
      throw new ApiError(401, "Invalid email or password");
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const token = signToken({ userId: user.id, role: user.role, employeeId: user.employee?.id }, rememberMe);
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await logAudit({ userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id, ipAddress: req.ip });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employee: user.employee
          ? {
              id: user.employee.id,
              employeeCode: user.employee.employeeCode,
              firstName: user.employee.firstName,
              lastName: user.employee.lastName,
              profilePicture: user.employee.profilePicture,
            }
          : null,
      },
    });
  })
);

router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await logAudit({ userId: req.user!.userId, action: "LOGOUT", ipAddress: req.ip });
    res.json({ success: true });
  })
);

const forgotPasswordSchema = z.object({ email: z.string().email() });

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to avoid leaking which emails are registered.
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });
      // In production this would be emailed. Returned here for local/dev usage.
      console.log(`Password reset token for ${email}: ${resetToken}`);
    }
    res.json({ success: true, message: "If the email exists, a reset link has been sent." });
  })
);

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    });
    if (!user) {
      throw new ApiError(400, "Invalid or expired reset token");
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });
    await logAudit({ userId: user.id, action: "PASSWORD_RESET", ipAddress: req.ip });
    res.json({ success: true });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw new ApiError(404, "User not found");
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new ApiError(400, "Current password is incorrect");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await logAudit({ userId: user.id, action: "PASSWORD_CHANGED", ipAddress: req.ip });
    res.json({ success: true });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        employee: {
          include: { department: true, position: true, manager: true },
        },
      },
    });
    if (!user) throw new ApiError(404, "User not found");
    const { passwordHash, resetToken, resetTokenExpiry, ...safeUser } = user;
    res.json(safeUser);
  })
);

export default router;
