/** Shape of the authenticated requester, as attached to req.user by requireAuth. */
export interface Viewer {
  role: string;
  employeeId?: string | null;
}

/** hourlyRate is sensitive compensation data: only the employee themselves or an admin may see it. */
export function canViewHourlyRate(viewer: Viewer, employeeId: string): boolean {
  return viewer.role === "ADMIN" || viewer.employeeId === employeeId;
}

/**
 * Returns a copy of an employee-shaped object with hourlyRate removed, unless the
 * viewer is an admin or the employee themselves. Safe to call on already-embedded
 * employee records (e.g. LeaveRequest.employee, LeaveRequest.approvedBy, Employee.manager).
 */
export function stripHourlyRate<T extends { id: string; hourlyRate?: number | null } | null | undefined>(
  employee: T,
  viewer: Viewer
): T {
  if (!employee) return employee;
  if (canViewHourlyRate(viewer, employee.id)) return employee;
  const clone: any = { ...employee };
  delete clone.hourlyRate;
  return clone;
}
