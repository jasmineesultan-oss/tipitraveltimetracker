-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "dailyRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "rate_history" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oldRate" DOUBLE PRECISION,
    "newRate" DOUBLE PRECISION NOT NULL,
    "changedBy" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_history_employeeId_idx" ON "rate_history"("employeeId");

-- AddForeignKey
ALTER TABLE "rate_history" ADD CONSTRAINT "rate_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
