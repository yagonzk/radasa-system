import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL não encontrada");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString })
  });

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT id, placa, renavam, status, "requestedAt"
      FROM "dnit_consultas"
      ORDER BY "requestedAt" DESC
      LIMIT 10
    `);

    console.log("=== FILA DNIT ===");
    console.log(rows);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
