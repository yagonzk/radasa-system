CREATE TABLE IF NOT EXISTS "sefaz_sync_state" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "ultNsu" TEXT NOT NULL DEFAULT '000000000000000',
  "maxNsu" TEXT NOT NULL DEFAULT '000000000000000',
  "lastCStat" TEXT NOT NULL DEFAULT '',
  "lastMessage" TEXT NOT NULL DEFAULT '',
  "lastQueryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sefaz_sync_state_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sefaz_sync_state_empresaId_key" ON "sefaz_sync_state"("empresaId");
CREATE INDEX IF NOT EXISTS "sefaz_sync_state_empresaId_idx" ON "sefaz_sync_state"("empresaId");

CREATE TABLE IF NOT EXISTS "sefaz_documentos" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "nsu" TEXT NOT NULL DEFAULT '',
  "schema" TEXT NOT NULL DEFAULT '',
  "tipo" TEXT NOT NULL DEFAULT 'NFE',
  "classificacao" TEXT NOT NULL DEFAULT 'OUTRO',
  "status" TEXT NOT NULL DEFAULT 'NOVO',
  "numero" TEXT NOT NULL DEFAULT '',
  "serie" TEXT NOT NULL DEFAULT '',
  "dataEmissao" DATE,
  "emitenteCnpj" TEXT NOT NULL DEFAULT '',
  "emitenteNome" TEXT NOT NULL DEFAULT '',
  "valorTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "placa" TEXT NOT NULL DEFAULT '',
  "hodometro" DECIMAL(14,1),
  "xmlUrl" TEXT,
  "dados" JSONB,
  "erro" TEXT NOT NULL DEFAULT '',
  "abastecimentoId" TEXT,
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sefaz_documentos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sefaz_documentos_chave_key" ON "sefaz_documentos"("chave");
CREATE UNIQUE INDEX IF NOT EXISTS "sefaz_documentos_empresaId_nsu_key" ON "sefaz_documentos"("empresaId", "nsu");
CREATE INDEX IF NOT EXISTS "sefaz_documentos_empresaId_idx" ON "sefaz_documentos"("empresaId");
CREATE INDEX IF NOT EXISTS "sefaz_documentos_status_idx" ON "sefaz_documentos"("status");
CREATE INDEX IF NOT EXISTS "sefaz_documentos_classificacao_idx" ON "sefaz_documentos"("classificacao");
CREATE INDEX IF NOT EXISTS "sefaz_documentos_dataEmissao_idx" ON "sefaz_documentos"("dataEmissao");
