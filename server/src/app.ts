import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";

import authRoutes from "./routes/auth.routes";
import employeesRoutes from "./routes/employees.routes";
import departmentsRoutes from "./routes/departments.routes";
import positionsRoutes from "./routes/positions.routes";
import attendanceRoutes from "./routes/attendance.routes";
import holidaysRoutes from "./routes/holidays.routes";
import leaveTypesRoutes from "./routes/leaveTypes.routes";
import leaveRequestsRoutes from "./routes/leaveRequests.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import reportsRoutes from "./routes/reports.routes";
import notificationsRoutes from "./routes/notifications.routes";
import auditLogsRoutes from "./routes/auditLogs.routes";
import settingsRoutes from "./routes/settings.routes";

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: config.clientUrl, credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/departments", departmentsRoutes);
app.use("/api/positions", positionsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/holidays", holidaysRoutes);
app.use("/api/leave-types", leaveTypesRoutes);
app.use("/api/leave-requests", leaveRequestsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/settings", settingsRoutes);

app.use(errorHandler);
