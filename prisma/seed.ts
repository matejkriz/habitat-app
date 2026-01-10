import { PrismaClient, UserRole, Presence, ExcuseStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

// Create PostgreSQL pool
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString,
  max: 10,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clean up existing data
  await prisma.auditLog.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.excuse.deleteMany();
  await prisma.closedDay.deleteMany();
  await prisma.parentChild.deleteMany();
  await prisma.child.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  // Create Director (Bětka)
  const director = await prisma.user.create({
    data: {
      email: "krizmate@gmail.com",
      name: "Bětka",
      role: UserRole.DIRECTOR,
      emailVerified: new Date(),
    },
  });
  console.log("✅ Created director:", director.name);

  // Create Teachers
  const teacher1 = await prisma.user.create({
    data: {
      email: "ucitel1@habitatzbraslav.cz",
      name: "Jana Nováková",
      role: UserRole.TEACHER,
      emailVerified: new Date(),
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      email: "krizmate+ucitel@gmail.com",
      name: "Matěj",
      role: UserRole.TEACHER,
      emailVerified: new Date(),
    },
  });
  console.log("✅ Created teachers:", teacher1.name, teacher2.name);

  // Create Parents
  const parent1 = await prisma.user.create({
    data: {
      email: "rodic1@example.com",
      name: "Marie Dvořáková",
      role: UserRole.PARENT,
      emailVerified: new Date(),
    },
  });

  const parent2 = await prisma.user.create({
    data: {
      email: "krizmate+rodic@gmail.com",
      name: "Jan Dvořák",
      role: UserRole.PARENT,
      emailVerified: new Date(),
    },
  });

  const parent3 = await prisma.user.create({
    data: {
      email: "rodic3@example.com",
      name: "Eva Černá",
      role: UserRole.PARENT,
      emailVerified: new Date(),
    },
  });

  const parent4 = await prisma.user.create({
    data: {
      email: "rodic4@example.com",
      name: "Tomáš Malý",
      role: UserRole.PARENT,
      emailVerified: new Date(),
    },
  });
  console.log("✅ Created parents");

  // Create Children
  const child1 = await prisma.child.create({
    data: {
      firstName: "Anička",
      lastName: "Dvořáková",
      active: true,
    },
  });

  const child2 = await prisma.child.create({
    data: {
      firstName: "Tomáš",
      lastName: "Dvořák",
      active: true,
    },
  });

  const child3 = await prisma.child.create({
    data: {
      firstName: "Eliška",
      lastName: "Černá",
      active: true,
    },
  });

  const child4 = await prisma.child.create({
    data: {
      firstName: "Jakub",
      lastName: "Malý",
      active: true,
    },
  });

  const child5 = await prisma.child.create({
    data: {
      firstName: "Karolína",
      lastName: "Malá",
      active: true,
    },
  });

  const child6 = await prisma.child.create({
    data: {
      firstName: "Matyáš",
      lastName: "Veselý",
      active: true,
    },
  });
  console.log("✅ Created children");

  // Link parents to children
  // Dvořákovi - both parents linked to both children
  await prisma.parentChild.createMany({
    data: [
      { parentId: parent1.id, childId: child1.id },
      { parentId: parent1.id, childId: child2.id },
      { parentId: parent2.id, childId: child1.id },
      { parentId: parent2.id, childId: child2.id },
      // Černá - single parent, one child
      { parentId: parent3.id, childId: child3.id },
      // Malý - single parent, two children
      { parentId: parent4.id, childId: child4.id },
      { parentId: parent4.id, childId: child5.id },
    ],
  });
  console.log("✅ Linked parents to children");

  // Create some closed days (holidays)
  const today = new Date();
  const closedDays = [];

  // Add some holidays
  closedDays.push({
    date: new Date(today.getFullYear(), 11, 23), // Dec 23
    description: "Vánoční prázdniny",
  });
  closedDays.push({
    date: new Date(today.getFullYear(), 11, 24), // Dec 24
    description: "Štědrý den",
  });
  closedDays.push({
    date: new Date(today.getFullYear(), 0, 1), // Jan 1
    description: "Nový rok",
  });

  await prisma.closedDay.createMany({
    data: closedDays,
  });
  console.log("✅ Created closed days");

  // Create sample attendance records for the past 2 weeks
  const children = [child1, child2, child3, child4, child5, child6];
  const attendanceRecords = [];
  const excuses = [];

  // Get dates for last 2 weeks (only Mon-Thu as school days)
  const getSchoolDays = (weeksBack: number): Date[] => {
    const days: Date[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = weeksBack * 7; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayOfWeek = date.getDay();
      // Monday = 1, Thursday = 4 (school days)
      if (dayOfWeek >= 1 && dayOfWeek <= 4) {
        days.push(date);
      }
    }
    return days;
  };

  const schoolDays = getSchoolDays(2);

  // Create an excuse for child1 (Anička) - a few days ago
  const excuseFromDate = new Date(schoolDays[schoolDays.length - 3] || today);
  const excuseToDate = new Date(schoolDays[schoolDays.length - 2] || today);

  const excuse1 = await prisma.excuse.create({
    data: {
      childId: child1.id,
      fromDate: excuseFromDate,
      toDate: excuseToDate,
      reason: "Nemoc - chřipka",
      submittedById: parent1.id,
      autoApproved: true,
    },
  });
  excuses.push(excuse1);
  console.log("✅ Created sample excuse");

  // Create attendance records
  for (const child of children) {
    for (const day of schoolDays) {
      // Skip future dates
      if (day > today) continue;

      // Check if this day falls within an excuse period
      const applicableExcuse = excuses.find(
        (e) => e.childId === child.id && day >= e.fromDate && day <= e.toDate
      );

      // 90% present, 10% absent
      const isPresent = applicableExcuse ? false : Math.random() > 0.1;

      attendanceRecords.push({
        childId: child.id,
        date: day,
        presence: isPresent ? Presence.PRESENT : Presence.ABSENT,
        excuseStatus: isPresent
          ? ExcuseStatus.NONE
          : applicableExcuse
          ? ExcuseStatus.EXCUSED
          : Math.random() > 0.5
          ? ExcuseStatus.EXCUSED
          : ExcuseStatus.UNEXCUSED,
        excuseId: applicableExcuse?.id || null,
        recordedById: teacher1.id,
      });
    }
  }

  // Use createMany with skipDuplicates to handle any duplicate dates
  await prisma.attendance.createMany({
    data: attendanceRecords,
    skipDuplicates: true,
  });
  console.log(`✅ Created ${attendanceRecords.length} attendance records`);

  console.log("\n🎉 Database seeded successfully!");
  console.log("\n📋 Test accounts:");
  console.log("  Director: skola@habitatzbraslav.cz");
  console.log("  Teacher: ucitel1@habitatzbraslav.cz");
  console.log("  Parent: rodic1@example.com (2 children: Anička, Tomáš)");
  console.log("  Parent: rodic3@example.com (1 child: Eliška)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
