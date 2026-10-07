CREATE TABLE "agro_estoque_posicoes" (
  "id" TEXT NOT NULL,
  "localId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nome" TEXT NOT NULL DEFAULT '',
  "setor" TEXT NOT NULL DEFAULT '',
  "tipo" TEXT NOT NULL DEFAULT 'PRATELEIRA',
  "linha" INTEGER NOT NULL,
  "coluna" INTEGER NOT NULL,
  "observacoes" TEXT NOT NULL DEFAULT '',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_estoque_posicoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agro_estoque_posicoes_localId_codigo_key" ON "agro_estoque_posicoes"("localId", "codigo");
CREATE UNIQUE INDEX "agro_estoque_posicoes_localId_linha_coluna_key" ON "agro_estoque_posicoes"("localId", "linha", "coluna");
CREATE INDEX "agro_estoque_posicoes_localId_ativo_linha_coluna_idx" ON "agro_estoque_posicoes"("localId", "ativo", "linha", "coluna");

ALTER TABLE "agro_estoque_posicoes" ADD CONSTRAINT "agro_estoque_posicoes_localId_fkey"
  FOREIGN KEY ("localId") REFERENCES "agro_estoque_locais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "agro_movimentacoes" ADD COLUMN "posicaoId" TEXT;
CREATE INDEX "agro_movimentacoes_posicaoId_data_idx" ON "agro_movimentacoes"("posicaoId", "data");
ALTER TABLE "agro_movimentacoes" ADD CONSTRAINT "agro_movimentacoes_posicaoId_fkey"
  FOREIGN KEY ("posicaoId") REFERENCES "agro_estoque_posicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agro_transferencias" ADD COLUMN "posicaoOrigemId" TEXT;
ALTER TABLE "agro_transferencias" ADD COLUMN "posicaoDestinoId" TEXT;
CREATE INDEX "agro_transferencias_posicaoOrigemId_data_idx" ON "agro_transferencias"("posicaoOrigemId", "data");
CREATE INDEX "agro_transferencias_posicaoDestinoId_data_idx" ON "agro_transferencias"("posicaoDestinoId", "data");
ALTER TABLE "agro_transferencias" ADD CONSTRAINT "agro_transferencias_posicaoOrigemId_fkey"
  FOREIGN KEY ("posicaoOrigemId") REFERENCES "agro_estoque_posicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agro_transferencias" ADD CONSTRAINT "agro_transferencias_posicaoDestinoId_fkey"
  FOREIGN KEY ("posicaoDestinoId") REFERENCES "agro_estoque_posicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agro_inventario_itens" ADD COLUMN "posicaoId" TEXT;
DROP INDEX IF EXISTS "agro_inventario_itens_inventarioId_produtoId_loteId_key";
CREATE UNIQUE INDEX "agro_inventario_itens_inventarioId_produtoId_loteId_posicaoId_key"
  ON "agro_inventario_itens"("inventarioId", "produtoId", "loteId", "posicaoId");
CREATE INDEX "agro_inventario_itens_posicaoId_idx" ON "agro_inventario_itens"("posicaoId");
ALTER TABLE "agro_inventario_itens" ADD CONSTRAINT "agro_inventario_itens_posicaoId_fkey"
  FOREIGN KEY ("posicaoId") REFERENCES "agro_estoque_posicoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
