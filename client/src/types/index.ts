export type Role = "ADMIN" | "EMPLOYEE";
export type EmployeeStatus = "ACTIVE" | "INACTIVE" | "TERMINATED" | "ON_LEAVE";
export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "HALF_DAY" | "ON_LEAVE" | "HOLIDAY" | "WEEKEND";
export type HolidayType = "REGULAR" | "SPECIAL_NON_WORKING" | "SPECIAL_WORKING" | "LOCAL";
export type WorkType = "OFFICE" | "WORK_FROM_HOME" | "FIELD_WORK";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
export type NotificationType =
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "LEAVE_SUBMITTED"
  | "HOLIDAY_TOMORROW"
  | "MISSING_TIME_OUT"
  | "LATE_TODAY"
  | "ATTENDANCE_ANOMALY"
  | "GENERAL";

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  _count?: { employees: number; positions: number };
}

export interface Position {
  id: string;
  title: string;
  departmentId?: string | null;
  department?: Department | null;
  _count?: { employees: number };
}

export interface Employee {
  id: string;
  employeeCode: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  departmentId?: string | null;
  department?: Department | null;
  positionId?: string | null;
  position?: Position | null;
  hireDate?: string | null;
  status: EmployeeStatus;
  managerId?: string | null;
  manager?: Employee | null;
  profilePicture?: string | null;
  role?: Role;
  isActive?: boolean;
  hasAccount?: boolean;
  temporaryPassword?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    profilePicture?: string | null;
  } | null;
}

export interface Attendance {
  id: string;
  employeeId: string;
  employee?: Employee;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  ipAddress?: string | null;
  device?: string | null;
  browser?: string | null;
  gpsLat?: number | null;
  gpsLng?: number | null;
  status: AttendanceStatus;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  totalHours: number;
  breakHours: number;
  isWeekend: boolean;
  holidayId?: string | null;
  holidayType?: HolidayType | null;
  holidayName?: string | null;
  holidayPayClass?: string | null;
  workType: WorkType;
  isManualEntry: boolean;
  manualEntryBy?: string | null;
  notes?: string | null;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  type: HolidayType;
  payClassification: string;
  province?: string | null;
  isActive: boolean;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  defaultDays: number;
  requiresAttachment: boolean;
  isActive: boolean;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType: LeaveType;
  year: number;
  allocatedDays: number;
  usedDays: number;
  remainingDays: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employee?: Employee;
  leaveTypeId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  attachmentUrl?: string | null;
  status: LeaveStatus;
  isPlanned: boolean;
  approvedById?: string | null;
  approvedBy?: Employee | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  user?: { email: string; employee?: Employee | null } | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  description?: string | null;
}
