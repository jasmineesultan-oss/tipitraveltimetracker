import { prisma } from "../lib/prisma";
import { getWorkSettings } from "./settings.service";
import { payClassificationFor } from "../utils/phHolidays";

/** Asia/Manila is a fixed UTC+8 offset with no daylight saving time. */
export const PH_OFFSET_MINUTES = 480;

export function toPhShifted(date: Date): Date {
  return new Date(date.getTime() + PH_OFFSET_MINUTES * 60 * 1000);
}

/**
 * Returns the UTC instant representing midnight Asia/Manila time on the
 * Philippines calendar day that `date` falls in. Stored timestamps remain
 * true UTC instants; only this calendar-day derivation is timezone-shifted.
 */
export function startOfDayUTC(date: Date): Date {
  const shifted = toPhShifted(date);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();
  return new Date(Date.UTC(y, m, d) - PH_OFFSET_MINUTES * 60 * 1000);
}

export function isWeekend(date: Date): boolean {
  const day = toPhShifted(date).getUTCDay();
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

function minutesSinceMidnightPH(date: Date): number {
  const shifted = toPhShifted(date);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

async function resolveWorkSchedule(employeeId: string) {
  const settings = await getWorkSettings();
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { scheduledStartTime: true, scheduledEndTime: true },
  });
  return {
    ...settings,
    workStartTime: employee?.scheduledStartTime || settings.workStartTime,
    workEndTime: employee?.scheduledEndTime || settings.workEndTime,
  };
}

export async function computeTimeIn(employeeId: string, timeIn: Date) {
  const settings = await resolveWorkSchedule(employeeId);
  const dayStart = startOfDayUTC(timeIn);
  const holiday = await findHolidayForDate(timeIn);
  const weekend = isWeekend(timeIn);

  const expectedStartMinutes = timeStringToMinutes(settings.workStartTime);
  const actualMinutes = minutesSinceMidnightPH(timeIn);
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

export async function computeTimeOut(
  employeeId: string,
  timeIn: Date,
  timeOut: Date,
  breakHours: number,
  existingStatus: string
) {
  const settings = await resolveWorkSchedule(employeeId);
  const grossHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60);
  const totalHours = Math.max(0, grossHours - (breakHours || 0));

  const expectedEndMinutes = timeStringToMinutes(settings.workEndTime);
  const actualOutMinutes = minutesSinceMidnightPH(timeOut);

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
