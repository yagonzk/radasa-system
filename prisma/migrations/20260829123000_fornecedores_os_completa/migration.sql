-- Cadastros > Fornecedores e evolução do módulo de Ordens de Serviço.
CREATE TABLE "fornecedores" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT NOT NULL DEFAULT '',
    "documento" TEXT NOT NULL DEFAULT '',
    "tipos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "telefone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "endereco" TEXT NOT NULL DEFAULT '',
    "cidade" TEXT NOT NULL DEFAULT '',
    "uf" TEXT NOT NULL DEFAULT '',
    "contato" TEXT NOT NULL DEFAULT '',
    "observacoes" TEXT NOT NULL DEFAULT '',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fornecedores_razaoSocial_idx" ON "fornecedores"("razaoSocial");
CREATE INDEX "fornecedores_nomeFantasia_idx" ON "fornecedores"("nomeFantasia");
CREATE INDEX "fornecedores_documento_idx" ON "fornecedores"("documento");
CREATE INDEX "fornecedores_ativo_idx" ON "fornecedores"("ativo");

ALTER TABLE "ordens_servico"
  ADD COLUMN "numeroFornecedor" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "servicoRealizado" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "responsavel" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "fornecedorId" TEXT,
  ADD COLUMN "kmConclusao" DECIMAL(14,2),
  ADD COLUMN "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0;

CREATE INDEX "ordens_servico_fornecedorId_idx" ON "ordens_servico"("fornecedorId");
ALTER TABLE "ordens_servico"
  ADD CONSTRAINT "ordens_servico_fornecedorId_fkey"
  FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ordem_servico_itens"
  ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'SERVICO',
  ADD COLUMN "descricao" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ordem_servico_itens" ALTER COLUMN "produtoId" DROP NOT NULL;
ALTER TABLE "ordem_servico_itens" DROP CONSTRAINT IF EXISTS "ordem_servico_itens_produtoId_fkey";
ALTER TABLE "ordem_servico_itens"
  ADD CONSTRAINT "ordem_servico_itens_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "estoque_produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ordem_servico_notas_fiscais" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "numero" TEXT NOT NULL DEFAULT '',
    "serie" TEXT NOT NULL DEFAULT '',
    "chaveAcesso" TEXT NOT NULL DEFAULT '',
    "dataEmissao" DATE,
    "valor" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "arquivoNome" TEXT NOT NULL DEFAULT '',
    "arquivoMime" TEXT NOT NULL DEFAULT '',
    "arquivoUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordem_servico_notas_fiscais_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ordem_servico_notas_fiscais_ordemServicoId_idx" ON "ordem_servico_notas_fiscais"("ordemServicoId");
CREATE INDEX "ordem_servico_notas_fiscais_numero_idx" ON "ordem_servico_notas_fiscais"("numero");
CREATE INDEX "ordem_servico_notas_fiscais_chaveAcesso_idx" ON "ordem_servico_notas_fiscais"("chaveAcesso");
ALTER TABLE "ordem_servico_notas_fiscais"
  ADD CONSTRAINT "ordem_servico_notas_fiscais_ordemServicoId_fkey"
  FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ordem_servico_anexos" (
    "id" TEXT NOT NULL,
    "ordemServicoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'OUTRO',
    "descricao" TEXT NOT NULL DEFAULT '',
    "arquivoNome" TEXT NOT NULL,
    "arquivoMime" TEXT NOT NULL DEFAULT '',
    "arquivoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ordem_servico_anexos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ordem_servico_anexos_ordemServicoId_idx" ON "ordem_servico_anexos"("ordemServicoId");
CREATE INDEX "ordem_servico_anexos_tipo_idx" ON "ordem_servico_anexos"("tipo");
ALTER TABLE "ordem_servico_anexos"
  ADD CONSTRAINT "ordem_servico_anexos_ordemServicoId_fkey"
  FOREIGN KEY ("ordemServicoId") REFERENCES "ordens_servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
