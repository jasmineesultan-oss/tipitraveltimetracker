import { NotificationType } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function notify(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      relatedEntityType: params.relatedEntityType,
      relatedEntityId: params.relatedEntityId,
    },
  });
}

export async function notifyAllAdmins(params: {
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true } });
  await Promise.all(
    admins.map((admin) =>
      notify({
        userId: admin.id,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
      })
    )
  );
}
