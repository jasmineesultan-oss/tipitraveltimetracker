import type { BadgeProps } from "@/components/ui/badge";

export const attendanceStatusVariant: Record<string, BadgeProps["variant"]> = {
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "danger",
  HALF_DAY: "info",
  ON_LEAVE: "purple",
  HOLIDAY: "info",
  WEEKEND: "outline",
};

export const leaveStatusVariant: Record<string, BadgeProps["variant"]> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "outline",
};

export const holidayTypeLabel: Record<string, string> = {
  REGULAR: "Regular Holiday",
  SPECIAL_NON_WORKING: "Special Non-Working",
  SPECIAL_WORKING: "Special Working",
  LOCAL: "Local Holiday",
};

export const leaveCalendarColor: Record<string, string> = {
  APPROVED: "bg-emerald-500",
  PENDING: "bg-amber-400",
  PLANNED: "bg-blue-500",
  REJECTED: "bg-red-500",
};

export const workTypeLabel: Record<string, string> = {
  OFFICE: "Office",
  WORK_FROM_HOME: "Work From Home",
  FIELD_WORK: "Field Work",
};

export const workTypeVariant: Record<string, BadgeProps["variant"]> = {
  OFFICE: "info",
  WORK_FROM_HOME: "purple",
  FIELD_WORK: "warning",
};
