import { useEffect, useState } from "react";
import { Users, UserCheck, UserX, CalendarClock, PartyPopper } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSpinner } from "@/components/shared/Spinner";
import { Badge } from "@/components/ui/badge";
import { MyTimeTrackingCard } from "@/components/shared/MyTimeTrackingCard";
import { formatDate } from "@/lib/utils";
import { holidayTypeLabel } from "@/lib/statusStyles";

const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2"];

interface AdminDashboardData {
  stats: { totalEmployees: number; present: number; absent: number; onLeave: number };
  upcomingHolidays: any[];
  upcomingLeaveRequests: any[];
  recentAttendance: any[];
  charts: {
    attendancePerMonth: { month: string; present: number; late: number; absent: number }[];
    leaveStatistics: { leaveType: string; totalDays: number }[];
    workingHoursTrend: { date: string; averageHours: number }[];
    departmentAttendance: { department: string; present: number; absent: number; total: number }[];
  };
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);

  useEffect(() => {
    api.get<AdminDashboardData>("/dashboard/admin").then((res) => setData(res.data));
  }, []);

  if (!data) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {user?.employee && <MyTimeTrackingCard />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Employees" value={data.stats.totalEmployees} icon={Users} accent="slate" />
        <StatCard label="Present Today" value={data.stats.present} icon={UserCheck} accent="emerald" />
        <StatCard label="Absent Today" value={data.stats.absent} icon={UserX} accent="red" />
        <StatCard label="On Leave" value={data.stats.onLeave} icon={CalendarClock} accent="purple" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance per Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.charts.attendancePerMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" fill="#059669" name="Present" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill="#dc2626" name="Absent" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Working Hours Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.charts.workingHoursTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="averageHours" stroke="#2563eb" strokeWidth={2} name="Avg Hours" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            {data.charts.leaveStatistics.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No approved leave data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data.charts.leaveStatistics} dataKey="totalDays" nameKey="leaveType" outerRadius={80} label>
                    {data.charts.leaveStatistics.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attendance by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.charts.departmentAttendance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="department" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" fill="#059669" name="Present" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill="#dc2626" name="Absent" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Leave Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingLeaveRequests.length === 0 && <p className="text-sm text-slate-400">No pending requests</p>}
            {data.upcomingLeaveRequests.map((lr) => (
              <div key={lr.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {lr.employee.firstName} {lr.employee.lastName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {lr.leaveType.name} &middot; {formatDate(lr.startDate)} - {formatDate(lr.endDate)}
                  </p>
                </div>
                <Badge variant="warning">Pending</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Holidays</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.upcomingHolidays.length === 0 && <p className="text-sm text-slate-400">No upcoming holidays</p>}
            {data.upcomingHolidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex items-center gap-2">
                  <PartyPopper className="h-4 w-4 text-brand-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{h.name}</p>
                    <p className="text-xs text-slate-500">{formatDate(h.date)}</p>
                  </div>
                </div>
                <Badge variant="info">{holidayTypeLabel[h.type]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentAttendance.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">
                {a.employee.firstName} {a.employee.lastName}
              </span>
              <span className="text-slate-500">{formatDate(a.date)}</span>
              <Badge variant="outline">{a.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
