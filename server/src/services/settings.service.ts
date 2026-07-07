import { prisma } from "../lib/prisma";

export async function getSetting(key: string, fallback: string): Promise<string> {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? fallback;
}

export async function getWorkSettings() {
  const [start, end, grace, standardHours, halfDayThreshold] = await Promise.all([
    getSetting("WORK_START_TIME", "09:00"),
    getSetting("WORK_END_TIME", "18:00"),
    getSetting("GRACE_PERIOD_MINUTES", "10"),
    getSetting("STANDARD_WORK_HOURS", "8"),
    getSetting("HALF_DAY_THRESHOLD_HOURS", "4"),
  ]);
  return {
    workStartTime: start,
    workEndTime: end,
    gracePeriodMinutes: parseInt(grace, 10),
    standardWorkHours: parseFloat(standardHours),
    halfDayThresholdHours: parseFloat(halfDayThreshold),
  };
}
