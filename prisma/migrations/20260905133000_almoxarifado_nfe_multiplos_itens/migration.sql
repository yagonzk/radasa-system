ALTER TABLE "estoque_produtos"
ADD COLUMN IF NOT EXISTS "ncm" TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS "estoque_notas_fiscais" (
  "id" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "numero" TEXT NOT NULL DEFAULT '',
  "serie" TEXT NOT NULL DEFAULT '',
  "dataEmissao" DATE NOT NULL,
  "fornecedorId" TEXT,
  "xmlUrl" TEXT,
  "xmlName" TEXT,
  "pdfUrl" TEXT,
  "pdfName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estoque_notas_fiscais_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "estoque_notas_fiscais_chave_key" ON "estoque_notas_fiscais"("chave");
CREATE INDEX IF NOT EXISTS "estoque_notas_fiscais_fornecedorId_idx" ON "estoque_notas_fiscais"("fornecedorId");
CREATE INDEX IF NOT EXISTS "estoque_notas_fiscais_dataEmissao_idx" ON "estoque_notas_fiscais"("dataEmissao");

ALTER TABLE "estoque_notas_fiscais"
ADD CONSTRAINT "estoque_notas_fiscais_fornecedorId_fkey"
FOREIGN KEY ("fornecedorId") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "estoque_movimentacoes"
ADD COLUMN IF NOT EXISTS "notaFiscalId" TEXT,
ADD COLUMN IF NOT EXISTS "codigoFornecedor" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "unidade" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "estoque_movimentacoes_notaFiscalId_idx" ON "estoque_movimentacoes"("notaFiscalId");
CREATE INDEX IF NOT EXISTS "estoque_movimentacoes_codigoFornecedor_idx" ON "estoque_movimentacoes"("codigoFornecedor");

ALTER TABLE "estoque_movimentacoes"
ADD CONSTRAINT "estoque_movimentacoes_notaFiscalId_fkey"
FOREIGN KEY ("notaFiscalId") REFERENCES "estoque_notas_fiscais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
