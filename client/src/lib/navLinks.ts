import {
  LayoutDashboard,
  Clock,
  CalendarDays,
  CalendarCheck2,
  Users,
  Building2,
  PartyPopper,
  FileBarChart,
  ScrollText,
  Settings,
  UserCircle,
  Clock4,
  type LucideIcon,
} from "lucide-react";

export interface NavLinkItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const adminLinks: NavLinkItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/attendance", label: "Attendance", icon: Clock },
  { to: "/leave-requests", label: "Leave Requests", icon: CalendarCheck2 },
  { to: "/leave-calendar", label: "Leave Calendar", icon: CalendarDays },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/departments", label: "Departments", icon: Building2 },
  { to: "/holidays", label: "Holidays", icon: PartyPopper },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const employeeLinks: NavLinkItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/my-attendance", label: "My Attendance", icon: Clock4 },
  { to: "/my-leave", label: "My Leave", icon: CalendarCheck2 },
  { to: "/leave-calendar", label: "Leave Calendar", icon: CalendarDays },
  { to: "/profile", label: "Profile", icon: UserCircle },
];
