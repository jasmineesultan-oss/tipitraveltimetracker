import { AuditAction } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function logAudit(params: {
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details,
      ipAddress: params.ipAddress,
    },
  });
}
