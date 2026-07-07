import { prisma } from "../lib/prisma";
import { getWorkSettings } from "./settings.service";
import { payClassificationFor } from "../utils/phHolidays";

export function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export async function findHolidayForDate(date: Date) {
  const dayStart = startOfDayUTC(date);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return prisma.holiday.findFirst({
    where: { date: { gte: dayStart, lt: dayEnd }, isActive: true },
  });
}

function timeStringToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

function minutesSinceMidnightUTC(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export async function computeTimeIn(employeeId: string, timeIn: Date) {
  const settings = await getWorkSettings();
  const dayStart = startOfDayUTC(timeIn);
  const holiday = await findHolidayForDate(timeIn);
  const weekend = isWeekend(timeIn);

  const expectedStartMinutes = timeStringToMinutes(settings.workStartTime);
  const actualMinutes = minutesSinceMidnightUTC(timeIn);
  const lateMinutes = Math.max(0, actualMinutes - expectedStartMinutes - settings.gracePeriodMinutes);

  let status: "PRESENT" | "LATE" | "WEEKEND" | "HOLIDAY" = lateMinutes > 0 ? "LATE" : "PRESENT";
  if (weekend) status = "WEEKEND";
  if (holiday && !weekend) status = "HOLIDAY";

  return {
    date: dayStart,
    lateMinutes,
    isWeekend: weekend,
    status,
    holidayId: holiday?.id ?? null,
    holidayType: holiday?.type ?? null,
    holidayName: holiday?.name ?? null,
    holidayPayClass: holiday ? payClassificationFor(holiday.type) : null,
  };
}

export async function computeTimeOut(timeIn: Date, timeOut: Date, breakHours: number, existingStatus: string) {
  const settings = await getWorkSettings();
  const grossHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60);
  const totalHours = Math.max(0, grossHours - (breakHours || 0));

  const expectedEndMinutes = timeStringToMinutes(settings.workEndTime);
  const actualOutMinutes = minutesSinceMidnightUTC(timeOut);

  const undertimeMinutes = Math.max(0, expectedEndMinutes - actualOutMinutes);
  const overtimeMinutes = Math.max(0, actualOutMinutes - expectedEndMinutes);

  let status = existingStatus;
  if (totalHours > 0 && totalHours < settings.halfDayThresholdHours && status !== "WEEKEND" && status !== "HOLIDAY") {
    status = "HALF_DAY";
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    undertimeMinutes,
    overtimeMinutes,
    status,
  };
}
