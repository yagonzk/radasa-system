import { prisma } from "../lib/prisma.js";

let pgcryptoReady = false;

async function ensurePgcrypto() {
  if (pgcryptoReady) return;
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  pgcryptoReady = true;
}

function normalizeBcryptHash(hash: string) {
  // bcryptjs gera $2b$. O pgcrypto historicamente trabalha com o prefixo
  // Blowfish $2a$; o conteúdo do hash é compatível, então normalizamos
  // apenas para a operação no banco sem alterar o hash salvo.
  if (hash.startsWith("$2b$") || hash.startsWith("$2y$")) {
    return `$2a$${hash.slice(4)}`;
  }
  return hash;
}

export async function verifyPassword(password: string, storedHash: string) {
  await ensurePgcrypto();
  const databaseHash = normalizeBcryptHash(storedHash);
  const rows = await prisma.$queryRaw<Array<{ matches: boolean }>>`
    SELECT crypt(${password}, ${databaseHash}) = ${databaseHash} AS "matches"
  `;
  return rows[0]?.matches === true;
}

export async function hashPassword(password: string) {
  await ensurePgcrypto();
  const rows = await prisma.$queryRaw<Array<{ hash: string }>>`
    SELECT crypt(${password}, gen_salt('bf', 12)) AS "hash"
  `;
  const hash = rows[0]?.hash;
  if (!hash) throw new Error("Não foi possível gerar o hash da senha no banco de dados.");
  return hash;
}
