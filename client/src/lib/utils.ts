import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", ...opts });
}

export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return "--:--";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
}

export function formatMinutes(minutes: number): string {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  return `₱${rate.toFixed(2)}/hr`;
}

export function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

/**
 * Converts a Philippines local wall-clock date+time (as typed into a date/time
 * input) into the correct UTC instant. Philippines is a fixed UTC+8 offset with
 * no DST, so this is a simple subtraction rather than a full timezone library.
 */
export function phLocalToUtcIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, h, min) - 8 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/**
 * Converts a stored UTC instant back into an "HH:mm" Philippines local wall-clock
 * string, e.g. for pre-filling a <input type="time"> from an API-returned ISO string.
 */
export function utcIsoToPhLocalTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour === "24" ? "00" : hour}:${minute}`;
}

/** Today's date in Asia/Manila as "YYYY-MM-DD". */
export function todayPhDateStr(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

/** Yesterday's date in Asia/Manila as "YYYY-MM-DD" - the latest date self-corrections may target. */
export function maxCorrectionDate(): string {
  const [y, m, d] = todayPhDateStr().split("-").map(Number);
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
  return yesterday.toISOString().slice(0, 10);
}
