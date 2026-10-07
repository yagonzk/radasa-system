CREATE TYPE "AgroTipoMovimentacao" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE_ENTRADA', 'AJUSTE_SAIDA');

CREATE TABLE "agro_produtos" (
  "id" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "categoria" TEXT NOT NULL DEFAULT '',
  "fabricante" TEXT NOT NULL DEFAULT '',
  "unidadeMedida" TEXT NOT NULL DEFAULT 'UN',
  "estoqueMinimo" DECIMAL(16,3) NOT NULL DEFAULT 0,
  "localizacao" TEXT NOT NULL DEFAULT '',
  "controlaLote" BOOLEAN NOT NULL DEFAULT false,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_produtos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agro_lotes" (
  "id" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "validade" DATE,
  "localizacao" TEXT NOT NULL DEFAULT '',
  "observacoes" TEXT NOT NULL DEFAULT '',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_lotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agro_movimentacoes" (
  "id" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "loteId" TEXT,
  "tipo" "AgroTipoMovimentacao" NOT NULL,
  "quantidade" DECIMAL(16,3) NOT NULL,
  "valorUnitario" DECIMAL(16,4) NOT NULL DEFAULT 0,
  "data" DATE NOT NULL,
  "responsavel" TEXT NOT NULL DEFAULT '',
  "destino" TEXT NOT NULL DEFAULT '',
  "documento" TEXT NOT NULL DEFAULT '',
  "observacoes" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_movimentacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agro_produtos_codigo_key" ON "agro_produtos"("codigo");
CREATE INDEX "agro_produtos_nome_idx" ON "agro_produtos"("nome");
CREATE INDEX "agro_produtos_categoria_ativo_idx" ON "agro_produtos"("categoria", "ativo");
CREATE UNIQUE INDEX "agro_lotes_produtoId_codigo_key" ON "agro_lotes"("produtoId", "codigo");
CREATE INDEX "agro_lotes_produtoId_ativo_idx" ON "agro_lotes"("produtoId", "ativo");
CREATE INDEX "agro_lotes_validade_idx" ON "agro_lotes"("validade");
CREATE INDEX "agro_movimentacoes_data_idx" ON "agro_movimentacoes"("data");
CREATE INDEX "agro_movimentacoes_produtoId_data_idx" ON "agro_movimentacoes"("produtoId", "data");
CREATE INDEX "agro_movimentacoes_loteId_data_idx" ON "agro_movimentacoes"("loteId", "data");
CREATE INDEX "agro_movimentacoes_tipo_data_idx" ON "agro_movimentacoes"("tipo", "data");

ALTER TABLE "agro_lotes"
  ADD CONSTRAINT "agro_lotes_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "agro_produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agro_movimentacoes"
  ADD CONSTRAINT "agro_movimentacoes_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "agro_produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agro_movimentacoes"
  ADD CONSTRAINT "agro_movimentacoes_loteId_fkey"
  FOREIGN KEY ("loteId") REFERENCES "agro_lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agro_movimentacoes"
  ADD CONSTRAINT "agro_movimentacoes_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
