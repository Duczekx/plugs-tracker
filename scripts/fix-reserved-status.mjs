import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const cutoffRaw = process.env.RESERVED_CUTOFF_DATE;
if (!cutoffRaw) {
  console.error("Missing RESERVED_CUTOFF_DATE env (ISO date, e.g. 2026-01-28).");
  process.exit(1);
}

const cutoff = new Date(cutoffRaw);
if (Number.isNaN(cutoff.getTime())) {
  console.error("Invalid RESERVED_CUTOFF_DATE. Use ISO date like 2026-01-28.");
  process.exit(1);
}

const isDryRun = process.env.DRY_RUN === "1";

const run = async () => {
  const where = {
    status: "RESERVED",
    createdAt: { lt: cutoff },
  };

  if (isDryRun) {
    const count = await prisma.shipment.count({ where });
    console.log(`[DRY RUN] Would update ${count} shipments to READY.`);
    return;
  }

  const result = await prisma.shipment.updateMany({
    where,
    data: { status: "READY" },
  });
  console.log(`Updated ${result.count} shipments to READY.`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
