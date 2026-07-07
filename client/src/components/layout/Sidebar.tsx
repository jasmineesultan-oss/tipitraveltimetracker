import { NavLink } from "react-router-dom";
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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const adminLinks = [
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

const employeeLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/my-attendance", label: "My Attendance", icon: Clock4 },
  { to: "/my-leave", label: "My Leave", icon: CalendarCheck2 },
  { to: "/leave-calendar", label: "Leave Calendar", icon: CalendarDays },
  { to: "/profile", label: "Profile", icon: UserCircle },
];

export function Sidebar() {
  const { user } = useAuth();
  const links = user?.role === "ADMIN" ? adminLinks : employeeLinks;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Clock className="h-4 w-4" />
        </div>
        <span className="text-lg font-semibold text-slate-900">TIPI</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              )
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
