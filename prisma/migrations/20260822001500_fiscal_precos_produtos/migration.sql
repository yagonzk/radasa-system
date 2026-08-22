CREATE TABLE IF NOT EXISTS "fiscal_precos_produtos" (
  "id" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "clienteId" TEXT,
  "vigenciaInicio" DATE NOT NULL,
  "custoUnitarioLebrinha" DECIMAL(14,4) NOT NULL,
  "vendaUnitarioCliente" DECIMAL(14,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fiscal_precos_produtos_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fiscal_precos_produtos_produtoId_fkey'
  ) THEN
    ALTER TABLE "fiscal_precos_produtos"
    ADD CONSTRAINT "fiscal_precos_produtos_produtoId_fkey"
    FOREIGN KEY ("produtoId") REFERENCES "produtos"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fiscal_precos_produtos_clienteId_fkey'
  ) THEN
    ALTER TABLE "fiscal_precos_produtos"
    ADD CONSTRAINT "fiscal_precos_produtos_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "clientes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "fiscal_precos_produtos_produtoId_idx"
ON "fiscal_precos_produtos"("produtoId");

CREATE INDEX IF NOT EXISTS "fiscal_precos_produtos_clienteId_idx"
ON "fiscal_precos_produtos"("clienteId");

CREATE INDEX IF NOT EXISTS "fiscal_precos_produtos_vigenciaInicio_idx"
ON "fiscal_precos_produtos"("vigenciaInicio");

CREATE INDEX IF NOT EXISTS "fiscal_precos_produtos_produtoId_clienteId_vigenciaInicio_idx"
ON "fiscal_precos_produtos"("produtoId", "clienteId", "vigenciaInicio");
