import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const titleMap: Record<string, string> = {
  "/": "Dashboard",
  "/attendance": "Attendance",
  "/leave-requests": "Leave Requests",
  "/leave-calendar": "Leave Calendar",
  "/employees": "Employees",
  "/departments": "Departments",
  "/holidays": "Holidays",
  "/reports": "Reports",
  "/audit-logs": "Audit Logs",
  "/settings": "Settings",
  "/my-attendance": "My Attendance",
  "/my-leave": "My Leave",
  "/profile": "My Profile",
};

export function AppLayout() {
  const location = useLocation();
  const title = titleMap[location.pathname] || "TIPI";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
