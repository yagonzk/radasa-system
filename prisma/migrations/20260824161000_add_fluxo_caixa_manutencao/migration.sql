CREATE TABLE IF NOT EXISTS "baixas_financeiras" (
"id" TEXT PRIMARY KEY,"lancamentoId" TEXT NOT NULL,"valor" DECIMAL(14,2) NOT NULL,"data" DATE NOT NULL,
"formaPagamento" TEXT NOT NULL DEFAULT '',"observacoes" TEXT NOT NULL DEFAULT '',"comprovanteNome" TEXT,"comprovanteUrl" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS "baixas_financeiras_lancamentoId_idx" ON "baixas_financeiras"("lancamentoId");
CREATE INDEX IF NOT EXISTS "baixas_financeiras_data_idx" ON "baixas_financeiras"("data");

CREATE TABLE IF NOT EXISTS "planos_manutencao" (
"id" TEXT PRIMARY KEY,"veiculoId" TEXT NOT NULL,"nome" TEXT NOT NULL,"categoria" TEXT NOT NULL DEFAULT 'PREVENTIVA',
"intervaloKm" DECIMAL(14,2),"intervaloDias" INTEGER,"ultimoKm" DECIMAL(14,2),"ultimaData" DATE,"proximoKm" DECIMAL(14,2),"proximaData" DATE,
"ativo" BOOLEAN NOT NULL DEFAULT TRUE,"observacoes" TEXT NOT NULL DEFAULT '',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS "planos_manutencao_veiculoId_idx" ON "planos_manutencao"("veiculoId");
CREATE INDEX IF NOT EXISTS "planos_manutencao_ativo_idx" ON "planos_manutencao"("ativo");

CREATE TABLE IF NOT EXISTS "ordens_servico" (
"id" TEXT PRIMARY KEY,"numero" TEXT NOT NULL UNIQUE,"veiculoId" TEXT NOT NULL,"tipo" TEXT NOT NULL DEFAULT 'PREVENTIVA',"status" TEXT NOT NULL DEFAULT 'ABERTA',
"descricao" TEXT NOT NULL,"fornecedor" TEXT NOT NULL DEFAULT '',"kmAbertura" DECIMAL(14,2),"dataAbertura" DATE NOT NULL,"dataConclusao" DATE,
"valorPecas" DECIMAL(14,2) NOT NULL DEFAULT 0,"valorMaoObra" DECIMAL(14,2) NOT NULL DEFAULT 0,"valorOutros" DECIMAL(14,2) NOT NULL DEFAULT 0,
"observacoes" TEXT NOT NULL DEFAULT '',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS "ordens_servico_veiculoId_idx" ON "ordens_servico"("veiculoId");
CREATE INDEX IF NOT EXISTS "ordens_servico_status_idx" ON "ordens_servico"("status");
CREATE INDEX IF NOT EXISTS "ordens_servico_dataAbertura_idx" ON "ordens_servico"("dataAbertura");

CREATE TABLE IF NOT EXISTS "documentos_frota" (
"id" TEXT PRIMARY KEY,"veiculoId" TEXT NOT NULL,"tipo" TEXT NOT NULL,"numero" TEXT NOT NULL DEFAULT '',"validade" DATE,
"observacoes" TEXT NOT NULL DEFAULT '',"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS "documentos_frota_veiculoId_idx" ON "documentos_frota"("veiculoId");
CREATE INDEX IF NOT EXISTS "documentos_frota_validade_idx" ON "documentos_frota"("validade");
