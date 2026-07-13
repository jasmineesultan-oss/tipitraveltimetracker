-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "gender" "Gender";

-- AlterTable
ALTER TABLE "leave_types" ADD COLUMN     "applicableGender" "Gender";
