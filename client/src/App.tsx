import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

import LoginPage from "@/pages/auth/LoginPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

import RoleDashboard from "@/pages/RoleDashboard";
import AttendancePage from "@/pages/admin/AttendancePage";
import LeaveRequestsPage from "@/pages/admin/LeaveRequestsPage";
import EmployeesPage from "@/pages/admin/EmployeesPage";
import DepartmentsPage from "@/pages/admin/DepartmentsPage";
import HolidaysPage from "@/pages/admin/HolidaysPage";
import ReportsPage from "@/pages/admin/ReportsPage";
import AuditLogsPage from "@/pages/admin/AuditLogsPage";
import SettingsPage from "@/pages/admin/SettingsPage";

import MyAttendancePage from "@/pages/employee/MyAttendancePage";
import MyLeavePage from "@/pages/employee/MyLeavePage";

import LeaveCalendarPage from "@/pages/shared/LeaveCalendarPage";
import ProfilePage from "@/pages/shared/ProfilePage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<RoleDashboard />} />
              <Route path="/leave-calendar" element={<LeaveCalendarPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              <Route path="/my-attendance" element={<MyAttendancePage />} />
              <Route path="/my-leave" element={<MyLeavePage />} />

              <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
                <Route path="/attendance" element={<AttendancePage />} />
                <Route path="/leave-requests" element={<LeaveRequestsPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/departments" element={<DepartmentsPage />} />
                <Route path="/holidays" element={<HolidaysPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/audit-logs" element={<AuditLogsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
