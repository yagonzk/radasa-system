ALTER TABLE "fechamento_viagens"
ADD COLUMN IF NOT EXISTS "dataViagem" DATE;

CREATE INDEX IF NOT EXISTS "fechamento_viagens_dataViagem_idx"
ON "fechamento_viagens"("dataViagem");
