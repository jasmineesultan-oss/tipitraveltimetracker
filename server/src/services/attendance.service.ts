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

/**
 * Runs once per day, on the first session created for that day: determines
 * the day-level fields (calendar day, weekend/holiday, initial status).
 * Late-tracking has been removed - status is only ever PRESENT/WEEKEND/HOLIDAY here.
 */
export async function computeTimeIn(employeeId: string, timeIn: Date) {
  const dayStart = startOfDayUTC(timeIn);
  const holiday = await findHolidayForDate(timeIn);
  const weekend = isWeekend(timeIn);

  let status: "PRESENT" | "WEEKEND" | "HOLIDAY" = "PRESENT";
  if (weekend) status = "WEEKEND";
  if (holiday && !weekend) status = "HOLIDAY";

  return {
    date: dayStart,
    isWeekend: weekend,
    status,
    holidayId: holiday?.id ?? null,
    holidayType: holiday?.type ?? null,
    holidayName: holiday?.name ?? null,
    holidayPayClass: holiday ? payClassificationFor(holiday.type) : null,
  };
}

/**
 * Recomputes a day's aggregate totals from all of its sessions. Call this
 * after any session create/update that has a timeOut, then persist the
 * returned fields onto the parent Attendance row.
 */
export async function computeDayAggregate(employeeId: string, attendanceId: string) {
  const settings = await resolveWorkSchedule(employeeId);
  const attendance = await prisma.attendance.findUnique({ where: { id: attendanceId } });
  const sessions = await prisma.attendanceSession.findMany({ where: { attendanceId } });

  let totalHours = 0;
  let hasOpenSession = false;
  for (const session of sessions) {
    if (session.timeOut) {
      const grossHours = (session.timeOut.getTime() - session.timeIn.getTime()) / (1000 * 60 * 60);
      totalHours += Math.max(0, grossHours - (session.breakHours || 0));
    } else {
      hasOpenSession = true;
    }
  }
  totalHours = Math.round(totalHours * 100) / 100;

  const targetMinutes = settings.standardWorkHours * 60;
  const totalMinutes = totalHours * 60;
  const undertimeMinutes = Math.max(0, Math.round(targetMinutes - totalMinutes));
  const overtimeMinutes = Math.max(0, Math.round(totalMinutes - targetMinutes));

  let status = attendance?.status ?? "PRESENT";
  if (status !== "WEEKEND" && status !== "HOLIDAY" && !hasOpenSession) {
    if (totalHours > 0 && totalHours < settings.halfDayThresholdHours) {
      status = "HALF_DAY";
    } else if (totalHours > 0) {
      status = "PRESENT";
    }
  }

  return { totalHours, undertimeMinutes, overtimeMinutes, status };
}
