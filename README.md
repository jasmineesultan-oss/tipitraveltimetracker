# TIPI Employee Time Tracking & Leave Management System

A full-stack HR system for attendance tracking, Philippine holiday detection, and leave management.

## Stack

- **Frontend**: React + TypeScript, Vite, Tailwind CSS, Radix UI primitives, TanStack Table, React Hook Form, Recharts
- **Backend**: Node.js + Express + TypeScript, Prisma ORM, PostgreSQL, JWT auth with RBAC
- **Reporting**: CSV, Excel (exceljs), and PDF (pdfkit) export

## Project Structure

```
server/   Express API (Prisma schema, routes, services)
client/   React SPA
```

## Getting Started

### 1. Database

Create a PostgreSQL database and set `DATABASE_URL` in `server/.env` (copy from `server/.env.example`).

### 2. Backend

```bash
cd server
npm install
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run seed                # seeds departments, leave types, PH holidays, admin/demo users
npm run dev                 # http://localhost:4000
```

Seeded accounts:
- Admin: `admin@tipi.com` / `Admin@12345`
- Employee: `juan.delacruz@tipi.com` / `Employee@12345`

### 3. Frontend

```bash
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api to :4000)
```

## Feature Coverage

Implemented: authentication (login, forgot/reset password, change password, remember me), RBAC (Admin/Employee), employee/department/position management, time in/out with automatic late/undertime/overtime/half-day computation, Philippine holiday detection and tagging (regular/special non-working/special working/local) with admin CRUD + fixed-holiday yearly sync, leave management (submission with attachments, approval/rejection/cancellation workflow, balances, planned-leave calendar), admin and employee dashboards with charts, attendance and leave calendars, reports (daily/weekly/monthly/yearly/department/employee/late/undertime/absent/leave/holiday/working-hours/overtime/payroll-summary) exportable to CSV/Excel/PDF, in-app notifications, and audit logging.

Not implemented (out of scope for this pass): QR code time in/out, facial recognition, fingerprint integration, offline-capable PWA packaging, automatic email delivery (reset tokens are logged server-side instead), automated backups, payroll system integration, and multi-company support. These were called out as "nice-to-have" / future enhancements in the original spec.
