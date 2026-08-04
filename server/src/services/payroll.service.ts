import { HolidayType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getSetting } from "./settings.service";

/**
 * Resolves the hourly rate that was in effect on `date`: the most recent
 * RateHistory row whose effectiveDate is on or before that date, falling back to
 * the employee's current hourlyRate if no history exists for that period yet
 * (e.g. their very first rate, recorded before RateHistory tracking applies to it).
 */
export async function resolveRateForDate(employeeId: string, date: Date): Promise<number | null> {
  const historyRow = await prisma.rateHistory.findFirst({
    where: { employeeId, effectiveDate: { lte: date } },
    orderBy: { effectiveDate: "desc" },
  });
  if (historyRow) return historyRow.newRate;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { hourlyRate: true } });
  return employee?.hourlyRate ?? null;
}

/**
 * Holiday pay percentages are admin-editable Settings rather than hardcoded
 * constants, since the commonly-cited DOLE figures can change and interpretations
 * vary by company. LOCAL holidays follow special-non-working rules, matching
 * payClassificationFor() in utils/phHolidays.ts.
 */
export async function holidayPayPercent(holidayType: HolidayType, workedThatDay: boolean): Promise<number> {
  if (holidayType === "REGULAR") {
    return parseFloat(
      await getSetting(workedThatDay ? "HOLIDAY_REGULAR_WORKED_PCT" : "HOLIDAY_REGULAR_UNWORKED_PCT", workedThatDay ? "200" : "100")
    );
  }
  if (holidayType === "SPECIAL_NON_WORKING" || holidayType === "LOCAL") {
    return parseFloat(
      await getSetting(
        workedThatDay ? "HOLIDAY_SPECIAL_NON_WORKING_WORKED_PCT" : "HOLIDAY_SPECIAL_NON_WORKING_UNWORKED_PCT",
        workedThatDay ? "130" : "0"
      )
    );
  }
  // SPECIAL_WORKING
  return parseFloat(await getSetting("HOLIDAY_SPECIAL_WORKING_PCT", "100"));
}

/**
 * Estimated peso holiday pay for one day, or null if the day wasn't a holiday
 * or the employee has no hourlyRate on record for the relevant period. Figures
 * are estimates based on configured Settings percentages - verify before use
 * in actual payroll.
 *
 * The stored rate is hourly, so the day's pay is hourlyRate * hoursForThatDay
 * * (percentage / 100), where hoursForThatDay is the day's actual worked hours
 * when the holiday was worked, or the employee's standard/scheduled daily hours
 * when it wasn't (they're paid as if they worked a normal day).
 */
export async function computeHolidayPay(
  employeeId: string,
  date: Date,
  holidayType: HolidayType | null,
  totalHoursWorked: number
): Promise<number | null> {
  if (!holidayType) return null;

  const rate = await resolveRateForDate(employeeId, date);
  if (rate === null) return null;

  const workedThatDay = totalHoursWorked > 0;
  const pct = await holidayPayPercent(holidayType, workedThatDay);

  let hoursForThatDay = totalHoursWorked;
  if (!workedThatDay) {
    hoursForThatDay = parseFloat(await getSetting("STANDARD_WORK_HOURS", "8"));
  }

  return Math.round(rate * hoursForThatDay * (pct / 100) * 100) / 100;
}

export interface DayBreakdown {
  date: Date;
  hoursWorked: number;
  /** Hours actually paid for this day - equal to hoursWorked, except on an unworked-but-recorded
   * holiday, where DOLE rules pay the employee's standard daily hours despite 0 hours worked. */
  payableHours: number;
  hourlyRate: number | null;
  isHoliday: boolean;
  holidayType: HolidayType | null;
  multiplierPct: number | null;
  baseAmount: number | null;
  holidayPay: number | null;
  overtimeHours: number;
  overtimePct: number | null;
  overtimePay: number | null;
  dayTotal: number | null;
  note?: string;
}

/**
 * Every input to one day's pay calculation, not just the final result, so the
 * computation is fully transparent to admins reviewing payroll. Figures are
 * estimates based on configured Settings percentages - verify before use in
 * actual payroll.
 */
export async function computeDayBreakdown(
  employeeId: string,
  date: Date,
  attendance: { totalHours: number; overtimeMinutes: number; holidayType: HolidayType | null } | null
): Promise<DayBreakdown> {
  const hoursWorked = attendance?.totalHours ?? 0;
  const holidayType = attendance?.holidayType ?? null;
  const isHoliday = holidayType !== null;
  const overtimeHours = Math.round(((attendance?.overtimeMinutes ?? 0) / 60) * 100) / 100;

  const hourlyRate = await resolveRateForDate(employeeId, date);
  if (hourlyRate === null) {
    return {
      date,
      hoursWorked,
      payableHours: 0,
      hourlyRate: null,
      isHoliday,
      holidayType,
      multiplierPct: null,
      baseAmount: null,
      holidayPay: null,
      overtimeHours,
      overtimePct: null,
      overtimePay: null,
      dayTotal: null,
      note: "No rate on record",
    };
  }

  const overtimePct = parseFloat(await getSetting("OVERTIME_PCT", "125"));
  const overtimePay = Math.round(overtimeHours * hourlyRate * (overtimePct / 100) * 100) / 100;
  const baseAmount = Math.round(hoursWorked * hourlyRate * 100) / 100;

  let multiplierPct: number | null = null;
  let holidayPay: number | null = null;
  let payableHours = hoursWorked;
  let dayTotal: number;

  if (isHoliday && holidayType) {
    const workedThatDay = hoursWorked > 0;
    multiplierPct = await holidayPayPercent(holidayType, workedThatDay);
    holidayPay = await computeHolidayPay(employeeId, date, holidayType, hoursWorked);
    payableHours = workedThatDay ? hoursWorked : parseFloat(await getSetting("STANDARD_WORK_HOURS", "8"));
    dayTotal = holidayPay ?? 0;
  } else {
    dayTotal = baseAmount + overtimePay;
  }

  return {
    date,
    hoursWorked,
    payableHours,
    hourlyRate,
    isHoliday,
    holidayType,
    multiplierPct,
    baseAmount,
    holidayPay,
    overtimeHours,
    overtimePct,
    overtimePay,
    dayTotal: Math.round(dayTotal * 100) / 100,
  };
}
