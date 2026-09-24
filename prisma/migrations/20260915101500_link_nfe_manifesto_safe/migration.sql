-- Migração exclusivamente aditiva para vincular NF-e ao Romaneio/BI.
-- Não altera viagens nem remove tabelas/dados legados.
ALTER TABLE "bi_nfes" ADD COLUMN IF NOT EXISTS "manifestoId" TEXT;
ALTER TABLE "bi_nfes" ADD COLUMN IF NOT EXISTS "naturezaOperacao" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bi_nfes" ADD COLUMN IF NOT EXISTS "municipio" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bi_nfes" ADD COLUMN IF NOT EXISTS "uf" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bi_nfes" ADD COLUMN IF NOT EXISTS "placaVeiculo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bi_nfes" ADD COLUMN IF NOT EXISTS "dadosEsqueleto" JSONB;
ALTER TABLE "bi_nfe_itens" ADD COLUMN IF NOT EXISTS "cst" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "bi_nfes_manifestoId_idx" ON "bi_nfes"("manifestoId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bi_nfes_manifestoId_fkey'
  ) THEN
    ALTER TABLE "bi_nfes"
      ADD CONSTRAINT "bi_nfes_manifestoId_fkey"
      FOREIGN KEY ("manifestoId") REFERENCES "manifestos"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
