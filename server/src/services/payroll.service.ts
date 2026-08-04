import { HolidayType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getSetting } from "./settings.service";

/**
 * Resolves the hourly rate that was in effect on `date`: the most recent
 * RateHistory row whose effectiveDate is on or before that date, falling back to
 * the employee's current hourlyRate if no history exists for that period yet
 * (e.g. their very first rate, recorded before RateHistory tracking applies to it).
 */
async function resolveRateForDate(employeeId: string, date: Date): Promise<number | null> {
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
async function holidayPayPercent(holidayType: HolidayType, workedThatDay: boolean): Promise<number> {
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
 * The stored rate is now hourly, so the day's pay is hourlyRate * hoursForThatDay
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
