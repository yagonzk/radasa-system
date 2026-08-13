import "dotenv/config";
import { Client } from "pg";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não encontrada no .env.");
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();

  // PostgreSQL requires a newly-added enum value to be committed before it is
  // used in DML. This statement runs in its own implicit transaction.
  await client.query(`ALTER TYPE "TipoManifesto" ADD VALUE IF NOT EXISTS 'VASILHAME'`);

  await client.query("BEGIN");
  const produtos = await client.query(`
    UPDATE "manifesto_produtos" AS mp
    SET "tipoManifesto" = 'VASILHAME'::"TipoManifesto"
    FROM "produtos" AS p
    WHERE mp."produtoId" = p."id"
      AND (
        UPPER(p."nome") LIKE '%VASILHAME%' OR
        UPPER(p."nome") LIKE '%VASILAME%' OR
        UPPER(p."nome") LIKE '%VASILEAME%'
      )
      AND mp."tipoManifesto" IS DISTINCT FROM 'VASILHAME'::"TipoManifesto"
  `);

  const manifestos = await client.query(`
    UPDATE "manifestos" AS m
    SET "tipoManifesto" = 'VASILHAME'::"TipoManifesto"
    WHERE EXISTS (
      SELECT 1 FROM "manifesto_produtos" mp WHERE mp."manifestoId" = m."id"
    )
    AND NOT EXISTS (
      SELECT 1 FROM "manifesto_produtos" mp
      WHERE mp."manifestoId" = m."id"
        AND COALESCE(mp."tipoManifesto", m."tipoManifesto") <> 'VASILHAME'::"TipoManifesto"
    )
  `);
  await client.query("COMMIT");

  console.log(`Vasilhames corrigidos: ${produtos.rowCount ?? 0} item(ns), ${manifestos.rowCount ?? 0} romaneio(s) exclusivamente de vasilhame.`);
} catch (error) {
  try { await client.query("ROLLBACK"); } catch {}
  throw error;
} finally {
  await client.end();
}
