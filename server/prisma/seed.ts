import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildHolidaySeedForYear } from "../src/utils/phHolidays";

const prisma = new PrismaClient();

const LEAVE_TYPES = [
  { name: "Vacation Leave", code: "VL", defaultDays: 15, requiresAttachment: false },
  { name: "Sick Leave", code: "SL", defaultDays: 15, requiresAttachment: false },
  { name: "Emergency Leave", code: "EL", defaultDays: 5, requiresAttachment: false },
  { name: "Bereavement Leave", code: "BL", defaultDays: 3, requiresAttachment: true },
  { name: "Maternity Leave", code: "ML", defaultDays: 105, requiresAttachment: true },
  { name: "Paternity Leave", code: "PL", defaultDays: 7, requiresAttachment: true },
  { name: "Study Leave", code: "STL", defaultDays: 5, requiresAttachment: false },
  { name: "Without Pay Leave", code: "WPL", defaultDays: 0, requiresAttachment: false },
  { name: "Other", code: "OTH", defaultDays: 0, requiresAttachment: false },
];

async function main() {
  console.log("Seeding departments & positions...");
  const engineering = await prisma.department.upsert({
    where: { name: "Engineering" },
    update: {},
    create: { name: "Engineering", code: "ENG", description: "Software Engineering" },
  });
  const hr = await prisma.department.upsert({
    where: { name: "Human Resources" },
    update: {},
    create: { name: "Human Resources", code: "HR", description: "Human Resources" },
  });

  const swePosition = await prisma.position.upsert({
    where: { id: "seed-swe-position" },
    update: {},
    create: { id: "seed-swe-position", title: "Software Engineer", departmentId: engineering.id },
  });
  const hrPosition = await prisma.position.upsert({
    where: { id: "seed-hr-position" },
    update: {},
    create: { id: "seed-hr-position", title: "HR Manager", departmentId: hr.id },
  });

  console.log("Seeding leave types...");
  const leaveTypeRecords: Record<string, string> = {};
  for (const lt of LEAVE_TYPES) {
    const rec = await prisma.leaveTypeModel.upsert({
      where: { code: lt.code },
      update: {},
      create: lt,
    });
    leaveTypeRecords[lt.code] = rec.id;
  }

  console.log("Seeding holidays...");
  const currentYear = new Date().getFullYear();
  for (const year of [currentYear, currentYear + 1]) {
    for (const h of buildHolidaySeedForYear(year)) {
      await prisma.holiday.upsert({
        where: { name_date: { name: h.name, date: h.date } },
        update: {},
        create: h,
      });
    }
  }

  console.log("Seeding admin user...");
  const adminPasswordHash = await bcrypt.hash("Admin@12345", 10);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@tipi.com" },
    update: {},
    create: {
      email: "admin@tipi.com",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });
  await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      employeeCode: "TIPI-0001",
      userId: adminUser.id,
      firstName: "System",
      lastName: "Administrator",
      email: "admin@tipi.com",
      departmentId: hr.id,
      positionId: hrPosition.id,
      hireDate: new Date(),
      status: "ACTIVE",
    },
  });

  console.log("Seeding sample employee user...");
  const empPasswordHash = await bcrypt.hash("Employee@12345", 10);
  const empUser = await prisma.user.upsert({
    where: { email: "juan.delacruz@tipi.com" },
    update: {},
    create: {
      email: "juan.delacruz@tipi.com",
      passwordHash: empPasswordHash,
      role: "EMPLOYEE",
    },
  });
  const employee = await prisma.employee.upsert({
    where: { userId: empUser.id },
    update: {},
    create: {
      employeeCode: "TIPI-0002",
      userId: empUser.id,
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "juan.delacruz@tipi.com",
      departmentId: engineering.id,
      positionId: swePosition.id,
      hireDate: new Date(),
      status: "ACTIVE",
    },
  });

  console.log("Seeding leave balances for sample employee...");
  for (const lt of LEAVE_TYPES) {
    await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: employee.id,
          leaveTypeId: leaveTypeRecords[lt.code],
          year: currentYear,
        },
      },
      update: {},
      create: {
        employeeId: employee.id,
        leaveTypeId: leaveTypeRecords[lt.code],
        year: currentYear,
        allocatedDays: lt.defaultDays,
        usedDays: 0,
      },
    });
  }

  console.log("Seeding company settings...");
  const settings = [
    { key: "WORK_START_TIME", value: "09:00", description: "Standard shift start time (HH:mm)" },
    { key: "WORK_END_TIME", value: "18:00", description: "Standard shift end time (HH:mm)" },
    { key: "GRACE_PERIOD_MINUTES", value: "10", description: "Minutes of grace before marked late" },
    { key: "STANDARD_WORK_HOURS", value: "8", description: "Standard working hours per day" },
    { key: "HALF_DAY_THRESHOLD_HOURS", value: "4", description: "Hours below which a full day counts as half day" },
    { key: "COMPANY_NAME", value: "TIPI", description: "Company name shown across the app" },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  console.log("Seed complete.");
  console.log("Admin login: admin@tipi.com / Admin@12345");
  console.log("Employee login: juan.delacruz@tipi.com / Employee@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
