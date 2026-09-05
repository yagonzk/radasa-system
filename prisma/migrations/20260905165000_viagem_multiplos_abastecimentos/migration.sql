CREATE TABLE "viagem_abastecimentos" (
  "viagemId" TEXT NOT NULL,
  "abastecimentoId" TEXT NOT NULL,
  "valorVinculado" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "viagem_abastecimentos_pkey" PRIMARY KEY ("viagemId", "abastecimentoId")
);

CREATE INDEX "viagem_abastecimentos_abastecimentoId_idx" ON "viagem_abastecimentos"("abastecimentoId");

ALTER TABLE "viagem_abastecimentos"
  ADD CONSTRAINT "viagem_abastecimentos_viagemId_fkey"
  FOREIGN KEY ("viagemId") REFERENCES "viagens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "viagem_abastecimentos"
  ADD CONSTRAINT "viagem_abastecimentos_abastecimentoId_fkey"
  FOREIGN KEY ("abastecimentoId") REFERENCES "abastecimentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserva os vínculos únicos já criados pela V33.72.
INSERT INTO "viagem_abastecimentos" ("viagemId", "abastecimentoId", "valorVinculado")
SELECT v."id", v."abastecimentoId", a."valorTotal"
FROM "viagens" v
JOIN "abastecimentos" a ON a."id" = v."abastecimentoId"
WHERE v."abastecimentoId" IS NOT NULL
ON CONFLICT ("viagemId", "abastecimentoId") DO NOTHING;
