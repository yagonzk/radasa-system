-- Fase 3.2: vincula cliente à viagem para rentabilidade por operação
ALTER TABLE "viagens" ADD COLUMN IF NOT EXISTS "clienteId" TEXT;
CREATE INDEX IF NOT EXISTS "viagens_clienteId_idx" ON "viagens"("clienteId");
