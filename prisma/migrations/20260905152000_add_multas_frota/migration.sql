CREATE TABLE IF NOT EXISTS "multas" (
  "id" TEXT NOT NULL,
  "veiculoId" TEXT NOT NULL,
  "motoristaId" TEXT,
  "autoInfracao" TEXT NOT NULL DEFAULT '',
  "codigoInfracao" TEXT NOT NULL DEFAULT '',
  "orgaoAutuador" TEXT NOT NULL DEFAULT '',
  "dataInfracao" DATE NOT NULL,
  "hora" TEXT NOT NULL DEFAULT '',
  "local" TEXT NOT NULL DEFAULT '',
  "descricao" TEXT NOT NULL DEFAULT '',
  "pontos" INTEGER NOT NULL DEFAULT 0,
  "valorOriginal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "valorAtual" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "vencimento" DATE,
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "observacoes" TEXT NOT NULL DEFAULT '',
  "documentoUrl" TEXT,
  "documentoNome" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "multas_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "multas" ADD CONSTRAINT "multas_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "multas" ADD CONSTRAINT "multas_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "multas_veiculoId_idx" ON "multas"("veiculoId");
CREATE INDEX IF NOT EXISTS "multas_motoristaId_idx" ON "multas"("motoristaId");
CREATE INDEX IF NOT EXISTS "multas_dataInfracao_idx" ON "multas"("dataInfracao");
CREATE INDEX IF NOT EXISTS "multas_vencimento_idx" ON "multas"("vencimento");
CREATE INDEX IF NOT EXISTS "multas_status_idx" ON "multas"("status");
CREATE INDEX IF NOT EXISTS "multas_autoInfracao_idx" ON "multas"("autoInfracao");
