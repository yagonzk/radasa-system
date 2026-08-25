ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "motoristaId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissoes" JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "detalhes" JSONB;

CREATE TABLE IF NOT EXISTS "comercial_propostas" (
  "id" TEXT PRIMARY KEY, "codigo" TEXT NOT NULL UNIQUE, "clienteId" TEXT NOT NULL,
  "origem" TEXT NOT NULL DEFAULT '', "destino" TEXT NOT NULL DEFAULT '',
  "distanciaKm" DECIMAL(14,2) NOT NULL DEFAULT 0, "valorFrete" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "custoEstimado" DECIMAL(14,2) NOT NULL DEFAULT 0, "margemPrevista" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'RASCUNHO', "validade" DATE, "observacoes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "comercial_propostas_clienteId_idx" ON "comercial_propostas"("clienteId");
CREATE INDEX IF NOT EXISTS "comercial_propostas_status_idx" ON "comercial_propostas"("status");
CREATE INDEX IF NOT EXISTS "comercial_propostas_validade_idx" ON "comercial_propostas"("validade");

CREATE TABLE IF NOT EXISTS "comercial_tabelas_frete" (
  "id" TEXT PRIMARY KEY, "clienteId" TEXT, "origem" TEXT NOT NULL DEFAULT '', "destino" TEXT NOT NULL DEFAULT '',
  "valorFrete" DECIMAL(14,2) NOT NULL DEFAULT 0, "valorKm" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "vigenciaInicio" DATE NOT NULL, "vigenciaFim" DATE, "observacoes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "comercial_tabelas_frete_clienteId_idx" ON "comercial_tabelas_frete"("clienteId");
CREATE INDEX IF NOT EXISTS "comercial_tabelas_frete_origem_destino_idx" ON "comercial_tabelas_frete"("origem","destino");
CREATE INDEX IF NOT EXISTS "comercial_tabelas_frete_vigenciaInicio_idx" ON "comercial_tabelas_frete"("vigenciaInicio");

CREATE TABLE IF NOT EXISTS "comercial_contratos" (
  "id" TEXT PRIMARY KEY, "numero" TEXT NOT NULL UNIQUE, "clienteId" TEXT NOT NULL, "inicio" DATE NOT NULL, "fim" DATE,
  "status" TEXT NOT NULL DEFAULT 'ATIVO', "indiceReajuste" TEXT NOT NULL DEFAULT '', "observacoes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "comercial_contratos_clienteId_idx" ON "comercial_contratos"("clienteId");
CREATE INDEX IF NOT EXISTS "comercial_contratos_status_idx" ON "comercial_contratos"("status");

CREATE TABLE IF NOT EXISTS "motorista_eventos" (
  "id" TEXT PRIMARY KEY, "motoristaId" TEXT NOT NULL, "viagemId" TEXT, "tipo" TEXT NOT NULL, "descricao" TEXT NOT NULL DEFAULT '',
  "valor" DECIMAL(14,2) NOT NULL DEFAULT 0, "arquivoNome" TEXT, "arquivoUrl" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "motorista_eventos_motoristaId_idx" ON "motorista_eventos"("motoristaId");
CREATE INDEX IF NOT EXISTS "motorista_eventos_viagemId_idx" ON "motorista_eventos"("viagemId");
CREATE INDEX IF NOT EXISTS "motorista_eventos_tipo_idx" ON "motorista_eventos"("tipo");
CREATE INDEX IF NOT EXISTS "motorista_eventos_createdAt_idx" ON "motorista_eventos"("createdAt");

CREATE TABLE IF NOT EXISTS "configuracoes_sistema" (
  "id" TEXT PRIMARY KEY, "chave" TEXT NOT NULL UNIQUE, "valor" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
