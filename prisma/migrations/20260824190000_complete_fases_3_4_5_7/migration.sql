ALTER TABLE "viagens"
 ADD COLUMN IF NOT EXISTS "codigo" TEXT,
 ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PLANEJADA',
 ADD COLUMN IF NOT EXISTS "cidadeOrigem" TEXT NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS "kmSaida" DECIMAL(14,1),
 ADD COLUMN IF NOT EXISTS "kmChegada" DECIMAL(14,1),
 ADD COLUMN IF NOT EXISTS "dataSaida" TIMESTAMP(3),
 ADD COLUMN IF NOT EXISTS "previsaoChegada" TIMESTAMP(3),
 ADD COLUMN IF NOT EXISTS "dataChegada" TIMESTAMP(3),
 ADD COLUMN IF NOT EXISTS "observacoes" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS "viagens_codigo_key" ON "viagens"("codigo");
CREATE INDEX IF NOT EXISTS "viagens_status_idx" ON "viagens"("status");

WITH ranked AS (
 SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn FROM "viagens" WHERE "codigo" IS NULL
)
UPDATE "viagens" v SET "codigo" = 'RAD-' || LPAD(r.rn::text, 5, '0') FROM ranked r WHERE v."id" = r."id";

ALTER TABLE "veiculos"
 ADD COLUMN IF NOT EXISTS "situacaoOperacional" TEXT NOT NULL DEFAULT 'DISPONIVEL',
 ADD COLUMN IF NOT EXISTS "ipvaValor" DECIMAL(14,2) NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "licenciamentoValor" DECIMAL(14,2) NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS "seguroValor" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "lancamentos_financeiros"
 ADD COLUMN IF NOT EXISTS "numeroDocumento" TEXT NOT NULL DEFAULT '',
 ADD COLUMN IF NOT EXISTS "parcelaNumero" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS "parcelaTotal" INTEGER NOT NULL DEFAULT 1,
 ADD COLUMN IF NOT EXISTS "grupoParcelamento" TEXT;
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_grupoParcelamento_idx" ON "lancamentos_financeiros"("grupoParcelamento");

CREATE TABLE IF NOT EXISTS "ordem_servico_itens" (
 "id" TEXT PRIMARY KEY,"ordemServicoId" TEXT NOT NULL,"produtoId" TEXT NOT NULL,"quantidade" DECIMAL(14,3) NOT NULL,"valorUnitario" DECIMAL(14,2) NOT NULL DEFAULT 0,"valorTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ordem_servico_itens_ordemServicoId_fkey" FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ordem_servico_itens_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "estoque_produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE INDEX IF NOT EXISTS "ordem_servico_itens_ordemServicoId_idx" ON "ordem_servico_itens"("ordemServicoId");
CREATE INDEX IF NOT EXISTS "ordem_servico_itens_produtoId_idx" ON "ordem_servico_itens"("produtoId");
