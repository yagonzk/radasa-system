CREATE TYPE "AgroStatusLavoura" AS ENUM ('PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA');
CREATE TYPE "AgroTipoOperacao" AS ENUM ('PLANTIO', 'ADUBACAO', 'PULVERIZACAO', 'APLICACAO', 'MONITORAMENTO', 'COLHEITA', 'OUTROS');

CREATE TABLE "agro_fazendas" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "cidade" TEXT NOT NULL DEFAULT '',
  "uf" TEXT NOT NULL DEFAULT '',
  "areaTotalHa" DECIMAL(16,3) NOT NULL DEFAULT 0,
  "observacoes" TEXT NOT NULL DEFAULT '',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_fazendas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agro_talhoes" (
  "id" TEXT NOT NULL,
  "fazendaId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "areaHa" DECIMAL(16,3) NOT NULL DEFAULT 0,
  "observacoes" TEXT NOT NULL DEFAULT '',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_talhoes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agro_safras" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "dataInicio" DATE,
  "dataFim" DATE,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_safras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agro_culturas" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_culturas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agro_lavouras" (
  "id" TEXT NOT NULL,
  "talhaoId" TEXT NOT NULL,
  "safraId" TEXT NOT NULL,
  "culturaId" TEXT NOT NULL,
  "areaHa" DECIMAL(16,3) NOT NULL DEFAULT 0,
  "status" "AgroStatusLavoura" NOT NULL DEFAULT 'PLANEJADA',
  "dataPlantio" DATE,
  "dataPrevisaoColheita" DATE,
  "observacoes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_lavouras_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agro_operacoes" (
  "id" TEXT NOT NULL,
  "lavouraId" TEXT NOT NULL,
  "tipo" "AgroTipoOperacao" NOT NULL,
  "data" DATE NOT NULL,
  "areaHa" DECIMAL(16,3) NOT NULL DEFAULT 0,
  "responsavel" TEXT NOT NULL DEFAULT '',
  "documento" TEXT NOT NULL DEFAULT '',
  "observacoes" TEXT NOT NULL DEFAULT '',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agro_operacoes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "agro_movimentacoes" ADD COLUMN "agroOperacaoId" TEXT;

CREATE UNIQUE INDEX "agro_fazendas_nome_key" ON "agro_fazendas"("nome");
CREATE INDEX "agro_fazendas_ativo_nome_idx" ON "agro_fazendas"("ativo", "nome");
CREATE UNIQUE INDEX "agro_talhoes_fazendaId_nome_key" ON "agro_talhoes"("fazendaId", "nome");
CREATE INDEX "agro_talhoes_fazendaId_ativo_idx" ON "agro_talhoes"("fazendaId", "ativo");
CREATE UNIQUE INDEX "agro_safras_nome_key" ON "agro_safras"("nome");
CREATE INDEX "agro_safras_ativo_nome_idx" ON "agro_safras"("ativo", "nome");
CREATE UNIQUE INDEX "agro_culturas_nome_key" ON "agro_culturas"("nome");
CREATE INDEX "agro_culturas_ativo_nome_idx" ON "agro_culturas"("ativo", "nome");
CREATE UNIQUE INDEX "agro_lavouras_talhaoId_safraId_culturaId_key" ON "agro_lavouras"("talhaoId", "safraId", "culturaId");
CREATE INDEX "agro_lavouras_safraId_status_idx" ON "agro_lavouras"("safraId", "status");
CREATE INDEX "agro_lavouras_culturaId_status_idx" ON "agro_lavouras"("culturaId", "status");
CREATE INDEX "agro_operacoes_lavouraId_data_idx" ON "agro_operacoes"("lavouraId", "data");
CREATE INDEX "agro_operacoes_tipo_data_idx" ON "agro_operacoes"("tipo", "data");
CREATE INDEX "agro_movimentacoes_agroOperacaoId_idx" ON "agro_movimentacoes"("agroOperacaoId");

ALTER TABLE "agro_talhoes" ADD CONSTRAINT "agro_talhoes_fazendaId_fkey"
  FOREIGN KEY ("fazendaId") REFERENCES "agro_fazendas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agro_lavouras" ADD CONSTRAINT "agro_lavouras_talhaoId_fkey"
  FOREIGN KEY ("talhaoId") REFERENCES "agro_talhoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agro_lavouras" ADD CONSTRAINT "agro_lavouras_safraId_fkey"
  FOREIGN KEY ("safraId") REFERENCES "agro_safras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agro_lavouras" ADD CONSTRAINT "agro_lavouras_culturaId_fkey"
  FOREIGN KEY ("culturaId") REFERENCES "agro_culturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agro_operacoes" ADD CONSTRAINT "agro_operacoes_lavouraId_fkey"
  FOREIGN KEY ("lavouraId") REFERENCES "agro_lavouras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agro_operacoes" ADD CONSTRAINT "agro_operacoes_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agro_movimentacoes" ADD CONSTRAINT "agro_movimentacoes_agroOperacaoId_fkey"
  FOREIGN KEY ("agroOperacaoId") REFERENCES "agro_operacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
