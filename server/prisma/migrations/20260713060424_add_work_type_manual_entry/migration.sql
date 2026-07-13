-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('OFFICE', 'WORK_FROM_HOME', 'FIELD_WORK');

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "isManualEntry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manualEntryBy" TEXT,
ADD COLUMN     "workType" "WorkType" NOT NULL DEFAULT 'OFFICE';
