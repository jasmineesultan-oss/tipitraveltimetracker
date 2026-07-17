-- Restructure attendance to support multiple sessions per day.
-- This migration backfills existing single time-in/time-out punches into the
-- new attendance_sessions table BEFORE dropping the old columns, so no
-- historical punch data is lost.

-- 1a. Create the new attendance_sessions table.
CREATE TABLE "attendance_sessions" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "timeIn" TIMESTAMP(3) NOT NULL,
    "timeOut" TIMESTAMP(3),
    "workType" "WorkType" NOT NULL DEFAULT 'OFFICE',
    "breakHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ipAddress" TEXT,
    "device" TEXT,
    "browser" TEXT,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
    "manualEntryBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "attendance_sessions_attendanceId_idx" ON "attendance_sessions"("attendanceId");

ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 1b. Backfill any existing punches into the new session table before the
-- old columns are dropped.
INSERT INTO attendance_sessions (id, "attendanceId", "timeIn", "timeOut", "workType", "breakHours", "ipAddress", "device", "browser", "gpsLat", "gpsLng", "isManualEntry", "manualEntryBy", "notes", "createdAt", "updatedAt")
SELECT gen_random_uuid(), id, "timeIn", "timeOut", "workType", "breakHours", "ipAddress", "device", "browser", "gpsLat", "gpsLng", "isManualEntry", "manualEntryBy", NULL, "createdAt", "updatedAt"
FROM attendance WHERE "timeIn" IS NOT NULL;

-- 1c. Drop the columns that moved to attendance_sessions, plus lateMinutes
-- (late-tracking is being dropped entirely).
ALTER TABLE "attendance" DROP COLUMN "breakHours",
DROP COLUMN "browser",
DROP COLUMN "device",
DROP COLUMN "gpsLat",
DROP COLUMN "gpsLng",
DROP COLUMN "ipAddress",
DROP COLUMN "isManualEntry",
DROP COLUMN "lateMinutes",
DROP COLUMN "manualEntryBy",
DROP COLUMN "timeIn",
DROP COLUMN "timeOut",
DROP COLUMN "workType";
