ALTER TABLE "manifesto_produtos"
  ADD COLUMN IF NOT EXISTS "clienteId" TEXT,
  ADD COLUMN IF NOT EXISTS "romaneio" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "notaFiscal" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "serieNf" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "instrucaoCobranca" TEXT NOT NULL DEFAULT '';

UPDATE "manifesto_produtos" AS mp
SET "clienteId" = m."clienteId"
FROM "manifestos" AS m
WHERE mp."manifestoId" = m."id"
  AND mp."clienteId" IS NULL;

CREATE INDEX IF NOT EXISTS "manifesto_produtos_clienteId_idx"
ON "manifesto_produtos"("clienteId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'manifesto_produtos_clienteId_fkey'
  ) THEN
    ALTER TABLE "manifesto_produtos"
      ADD CONSTRAINT "manifesto_produtos_clienteId_fkey"
      FOREIGN KEY ("clienteId")
      REFERENCES "clientes"("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END
$$;
