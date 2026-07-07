import { useAuth } from "@/context/AuthContext";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import EmployeeDashboardPage from "@/pages/employee/EmployeeDashboardPage";

export default function RoleDashboard() {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? <AdminDashboardPage /> : <EmployeeDashboardPage />;
}
