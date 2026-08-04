-- RenameColumn
-- The dailyRate column is being repurposed to represent an hourly rate. Raw
-- numeric values already entered are preserved as-is, but their meaning has
-- changed (per-day -> per-hour) and should be reviewed/re-entered by an admin.
ALTER TABLE "employees" RENAME COLUMN "dailyRate" TO "hourlyRate";

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('REGULAR', 'INTERN', 'CONTRACTUAL', 'PROBATIONARY');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'REGULAR';

-- AlterTable
-- newRate becomes nullable so a RateHistory row can represent "rate cleared"
-- (e.g. when an employee's employment type changes to INTERN).
ALTER TABLE "rate_history" ALTER COLUMN "newRate" DROP NOT NULL;
