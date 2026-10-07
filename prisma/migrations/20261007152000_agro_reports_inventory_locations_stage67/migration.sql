ALTER TYPE "AgroTipoMovimentacao" ADD VALUE IF NOT EXISTS 'TRANSFERENCIA_ENTRADA';
ALTER TYPE "AgroTipoMovimentacao" ADD VALUE IF NOT EXISTS 'TRANSFERENCIA_SAIDA';
ALTER TYPE "AgroTipoMovimentacao" ADD VALUE IF NOT EXISTS 'INVENTARIO_ENTRADA';
ALTER TYPE "AgroTipoMovimentacao" ADD VALUE IF NOT EXISTS 'INVENTARIO_SAIDA';

CREATE TYPE "AgroStatusInventario" AS ENUM ('ABERTO', 'FINALIZADO', 'CANCELADO');

CREATE TABLE "agro_estoque_locais" (
  "id" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT NOT NULL DEFAULT '',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "principal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_estoque_locais_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agro_estoque_locais_codigo_key" ON "agro_estoque_locais"("codigo");
CREATE UNIQUE INDEX "agro_estoque_locais_nome_key" ON "agro_estoque_locais"("nome");
CREATE INDEX "agro_estoque_locais_ativo_nome_idx" ON "agro_estoque_locais"("ativo", "nome");

INSERT INTO "agro_estoque_locais" ("id", "codigo", "nome", "descricao", "ativo", "principal", "createdAt", "updatedAt")
VALUES ('agro-local-principal', 'BAR-001', 'Barracão Principal', 'Local padrão criado automaticamente na migração.', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "agro_movimentacoes" ADD COLUMN "localId" TEXT;
ALTER TABLE "agro_movimentacoes" ADD COLUMN "transferenciaId" TEXT;
ALTER TABLE "agro_movimentacoes" ADD COLUMN "inventarioId" TEXT;
UPDATE "agro_movimentacoes" SET "localId" = 'agro-local-principal' WHERE "localId" IS NULL;
ALTER TABLE "agro_movimentacoes" ALTER COLUMN "localId" SET NOT NULL;

CREATE INDEX "agro_movimentacoes_localId_data_idx" ON "agro_movimentacoes"("localId", "data");
CREATE INDEX "agro_movimentacoes_transferenciaId_idx" ON "agro_movimentacoes"("transferenciaId");
CREATE INDEX "agro_movimentacoes_inventarioId_idx" ON "agro_movimentacoes"("inventarioId");

ALTER TABLE "agro_movimentacoes" ADD CONSTRAINT "agro_movimentacoes_localId_fkey"
  FOREIGN KEY ("localId") REFERENCES "agro_estoque_locais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "agro_transferencias" (
  "id" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "loteId" TEXT,
  "localOrigemId" TEXT NOT NULL,
  "localDestinoId" TEXT NOT NULL,
  "quantidade" DECIMAL(16,3) NOT NULL,
  "valorUnitario" DECIMAL(16,4) NOT NULL DEFAULT 0,
  "data" DATE NOT NULL,
  "responsavel" TEXT NOT NULL DEFAULT '',
  "documento" TEXT NOT NULL DEFAULT '',
  "observacoes" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_transferencias_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agro_transferencias_data_idx" ON "agro_transferencias"("data");
CREATE INDEX "agro_transferencias_produtoId_data_idx" ON "agro_transferencias"("produtoId", "data");
CREATE INDEX "agro_transferencias_localOrigemId_data_idx" ON "agro_transferencias"("localOrigemId", "data");
CREATE INDEX "agro_transferencias_localDestinoId_data_idx" ON "agro_transferencias"("localDestinoId", "data");

ALTER TABLE "agro_transferencias" ADD CONSTRAINT "agro_transferencias_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "agro_produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agro_transferencias" ADD CONSTRAINT "agro_transferencias_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "agro_lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agro_transferencias" ADD CONSTRAINT "agro_transferencias_localOrigemId_fkey" FOREIGN KEY ("localOrigemId") REFERENCES "agro_estoque_locais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agro_transferencias" ADD CONSTRAINT "agro_transferencias_localDestinoId_fkey" FOREIGN KEY ("localDestinoId") REFERENCES "agro_estoque_locais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agro_transferencias" ADD CONSTRAINT "agro_transferencias_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "agro_inventarios" (
  "id" TEXT NOT NULL,
  "localId" TEXT NOT NULL,
  "data" DATE NOT NULL,
  "status" "AgroStatusInventario" NOT NULL DEFAULT 'ABERTO',
  "descricao" TEXT NOT NULL DEFAULT '',
  "observacoes" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT,
  "finalizadoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_inventarios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agro_inventarios_localId_data_idx" ON "agro_inventarios"("localId", "data");
CREATE INDEX "agro_inventarios_status_data_idx" ON "agro_inventarios"("status", "data");
ALTER TABLE "agro_inventarios" ADD CONSTRAINT "agro_inventarios_localId_fkey" FOREIGN KEY ("localId") REFERENCES "agro_estoque_locais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agro_inventarios" ADD CONSTRAINT "agro_inventarios_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "agro_inventario_itens" (
  "id" TEXT NOT NULL,
  "inventarioId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "loteId" TEXT,
  "saldoSistema" DECIMAL(16,3) NOT NULL DEFAULT 0,
  "contagemFisica" DECIMAL(16,3) NOT NULL DEFAULT 0,
  "diferenca" DECIMAL(16,3) NOT NULL DEFAULT 0,
  "custoUnitario" DECIMAL(16,4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_inventario_itens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agro_inventario_itens_inventarioId_produtoId_loteId_key" ON "agro_inventario_itens"("inventarioId", "produtoId", "loteId");
CREATE INDEX "agro_inventario_itens_produtoId_idx" ON "agro_inventario_itens"("produtoId");
CREATE INDEX "agro_inventario_itens_loteId_idx" ON "agro_inventario_itens"("loteId");
ALTER TABLE "agro_inventario_itens" ADD CONSTRAINT "agro_inventario_itens_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "agro_inventarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agro_inventario_itens" ADD CONSTRAINT "agro_inventario_itens_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "agro_produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agro_inventario_itens" ADD CONSTRAINT "agro_inventario_itens_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "agro_lotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agro_movimentacoes" ADD CONSTRAINT "agro_movimentacoes_transferenciaId_fkey" FOREIGN KEY ("transferenciaId") REFERENCES "agro_transferencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agro_movimentacoes" ADD CONSTRAINT "agro_movimentacoes_inventarioId_fkey" FOREIGN KEY ("inventarioId") REFERENCES "agro_inventarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
