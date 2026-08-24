CREATE TABLE IF NOT EXISTS "centros_custo" (
  "id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL, "tipo" TEXT NOT NULL DEFAULT 'ADMINISTRATIVO', "ativo" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "centros_custo_nome_idx" ON "centros_custo"("nome");
CREATE TABLE IF NOT EXISTS "lancamentos_financeiros" (
  "id" TEXT PRIMARY KEY, "tipo" TEXT NOT NULL, "descricao" TEXT NOT NULL, "categoria" TEXT NOT NULL, "subcategoria" TEXT NOT NULL DEFAULT '', "valor" DECIMAL(14,2) NOT NULL, "dataCompetencia" DATE NOT NULL, "dataVencimento" DATE, "dataPagamento" DATE, "status" TEXT NOT NULL DEFAULT 'PENDENTE', "clienteId" TEXT, "fornecedor" TEXT NOT NULL DEFAULT '', "veiculoId" TEXT, "viagemId" TEXT, "centroCustoId" TEXT, "formaPagamento" TEXT NOT NULL DEFAULT '', "observacoes" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_tipo_idx" ON "lancamentos_financeiros"("tipo");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_status_idx" ON "lancamentos_financeiros"("status");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_dataCompetencia_idx" ON "lancamentos_financeiros"("dataCompetencia");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_dataVencimento_idx" ON "lancamentos_financeiros"("dataVencimento");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_veiculoId_idx" ON "lancamentos_financeiros"("veiculoId");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_viagemId_idx" ON "lancamentos_financeiros"("viagemId");
CREATE INDEX IF NOT EXISTS "lancamentos_financeiros_centroCustoId_idx" ON "lancamentos_financeiros"("centroCustoId");
