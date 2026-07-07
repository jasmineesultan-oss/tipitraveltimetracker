import { HolidayType } from "@prisma/client";

export interface HolidaySeedEntry {
  name: string;
  month: number;
  day: number;
  type: HolidayType;
}

/**
 * Fixed-date Philippine national holidays (Republic Act 9849 / Proclamation-based).
 * Movable holidays (Chinese New Year, Eid'l Fitr, Eid'l Adha, Ninoy Aquino Day
 * observance shifts) vary yearly by presidential proclamation and are not
 * computable from a formula, so they are seeded for the current/next year only
 * and otherwise left to admin management via the Holidays page.
 */
export const FIXED_PH_HOLIDAYS: HolidaySeedEntry[] = [
  { name: "New Year's Day", month: 1, day: 1, type: "REGULAR" },
  { name: "People Power Anniversary", month: 2, day: 25, type: "SPECIAL_NON_WORKING" },
  { name: "Araw ng Kagitingan", month: 4, day: 9, type: "REGULAR" },
  { name: "Labor Day", month: 5, day: 1, type: "REGULAR" },
  { name: "Independence Day", month: 6, day: 12, type: "REGULAR" },
  { name: "Ninoy Aquino Day", month: 8, day: 21, type: "SPECIAL_NON_WORKING" },
  { name: "National Heroes Day", month: 8, day: 26, type: "REGULAR" },
  { name: "All Saints' Day", month: 11, day: 1, type: "SPECIAL_NON_WORKING" },
  { name: "All Souls' Day", month: 11, day: 2, type: "SPECIAL_NON_WORKING" },
  { name: "Bonifacio Day", month: 11, day: 30, type: "REGULAR" },
  { name: "Immaculate Conception", month: 12, day: 8, type: "SPECIAL_NON_WORKING" },
  { name: "Christmas Eve", month: 12, day: 24, type: "SPECIAL_NON_WORKING" },
  { name: "Christmas Day", month: 12, day: 25, type: "REGULAR" },
  { name: "Rizal Day", month: 12, day: 30, type: "REGULAR" },
  { name: "Last Day of the Year", month: 12, day: 31, type: "SPECIAL_NON_WORKING" },
];

export function payClassificationFor(type: HolidayType): string {
  switch (type) {
    case "REGULAR":
      return "100% pay if unworked; 200% if worked (first 8 hours)";
    case "SPECIAL_NON_WORKING":
      return "No pay if unworked (unless company policy grants it); +30% if worked";
    case "SPECIAL_WORKING":
      return "No premium; normal pay applies";
    case "LOCAL":
      return "Follows special non-working holiday pay rules within the applicable locality";
    default:
      return "Normal Working Day";
  }
}

export function buildHolidaySeedForYear(year: number) {
  return FIXED_PH_HOLIDAYS.map((h) => ({
    name: h.name,
    date: new Date(Date.UTC(year, h.month - 1, h.day)),
    type: h.type,
    payClassification: payClassificationFor(h.type),
    province: null as string | null,
    isActive: true,
  }));
}
