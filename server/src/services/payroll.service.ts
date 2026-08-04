import { HolidayType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getSetting } from "./settings.service";

/**
 * Resolves the daily rate that was in effect on `date`: the most recent
 * RateHistory row whose effectiveDate is on or before that date, falling back to
 * the employee's current dailyRate if no history exists for that period yet
 * (e.g. their very first rate, recorded before RateHistory tracking applies to it).
 */
async function resolveRateForDate(employeeId: string, date: Date): Promise<number | null> {
  const historyRow = await prisma.rateHistory.findFirst({
    where: { employeeId, effectiveDate: { lte: date } },
    orderBy: { effectiveDate: "desc" },
  });
  if (historyRow) return historyRow.newRate;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { dailyRate: true } });
  return employee?.dailyRate ?? null;
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
 * or the employee has no dailyRate on record for the relevant period. Figures
 * are estimates based on configured Settings percentages - verify before use
 * in actual payroll.
 */
export async function computeHolidayPay(
  employeeId: string,
  date: Date,
  holidayType: HolidayType | null,
  workedThatDay: boolean
): Promise<number | null> {
  if (!holidayType) return null;

  const rate = await resolveRateForDate(employeeId, date);
  if (rate === null) return null;

  const pct = await holidayPayPercent(holidayType, workedThatDay);
  return Math.round(rate * (pct / 100) * 100) / 100;
}
