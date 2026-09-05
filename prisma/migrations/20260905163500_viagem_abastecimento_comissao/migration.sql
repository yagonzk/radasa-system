ALTER TABLE "viagens" ADD COLUMN "abastecimentoId" TEXT;
ALTER TABLE "viagens" ADD COLUMN "valorComissao" DECIMAL(14,2) NOT NULL DEFAULT 0;
CREATE INDEX "viagens_abastecimentoId_idx" ON "viagens"("abastecimentoId");
ALTER TABLE "viagens" ADD CONSTRAINT "viagens_abastecimentoId_fkey" FOREIGN KEY ("abastecimentoId") REFERENCES "abastecimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
