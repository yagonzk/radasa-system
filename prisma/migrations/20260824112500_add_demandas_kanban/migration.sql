CREATE TYPE "StatusDemanda" AS ENUM ('BACKLOG', 'A_FAZER', 'EM_ANDAMENTO', 'AGUARDANDO', 'CONCLUIDA');
CREATE TYPE "PrioridadeDemanda" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

CREATE TABLE "demandas" (
  "id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL DEFAULT '',
  "status" "StatusDemanda" NOT NULL DEFAULT 'A_FAZER',
  "prioridade" "PrioridadeDemanda" NOT NULL DEFAULT 'MEDIA',
  "responsavel" TEXT NOT NULL DEFAULT '',
  "etiquetas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "dataPrazo" DATE,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "arquivada" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "demandas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demandas_status_ordem_idx" ON "demandas"("status", "ordem");
CREATE INDEX "demandas_dataPrazo_idx" ON "demandas"("dataPrazo");
CREATE INDEX "demandas_arquivada_idx" ON "demandas"("arquivada");
