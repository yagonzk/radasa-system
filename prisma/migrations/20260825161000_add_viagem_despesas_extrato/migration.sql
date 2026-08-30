CREATE TABLE IF NOT EXISTS "viagem_despesas_extrato" (
  "id" TEXT NOT NULL,
  "viagemId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "data" DATE NOT NULL,
  "hora" TEXT NOT NULL DEFAULT '',
  "valor" DECIMAL(14,2) NOT NULL,
  "descricao" TEXT NOT NULL DEFAULT '',
  "colaborador" TEXT NOT NULL DEFAULT '',
  "origem" TEXT NOT NULL DEFAULT 'TRUCKPAG',
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "viagem_despesas_extrato_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "viagem_despesas_extrato_fingerprint_key" UNIQUE ("fingerprint"),
  CONSTRAINT "viagem_despesas_extrato_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "viagens"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "viagem_despesas_extrato_viagemId_idx" ON "viagem_despesas_extrato"("viagemId");
CREATE INDEX IF NOT EXISTS "viagem_despesas_extrato_tipo_idx" ON "viagem_despesas_extrato"("tipo");
CREATE INDEX IF NOT EXISTS "viagem_despesas_extrato_data_idx" ON "viagem_despesas_extrato"("data");
