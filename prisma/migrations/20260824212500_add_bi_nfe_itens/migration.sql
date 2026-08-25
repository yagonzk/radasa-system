CREATE TABLE IF NOT EXISTS "bi_nfes" (
  "id" TEXT PRIMARY KEY,
  "chave" TEXT NOT NULL UNIQUE,
  "numero" TEXT NOT NULL DEFAULT '',
  "serie" TEXT NOT NULL DEFAULT '',
  "dataEmissao" DATE,
  "emitenteCnpj" TEXT NOT NULL DEFAULT '',
  "emitenteNome" TEXT NOT NULL DEFAULT '',
  "destinatarioCnpj" TEXT NOT NULL DEFAULT '',
  "destinatarioNome" TEXT NOT NULL DEFAULT '',
  "valorProdutos" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "valorNota" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "arquivoNome" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "bi_nfes_numero_serie_idx" ON "bi_nfes"("numero", "serie");
CREATE INDEX IF NOT EXISTS "bi_nfes_dataEmissao_idx" ON "bi_nfes"("dataEmissao");

CREATE TABLE IF NOT EXISTS "bi_nfe_itens" (
  "id" TEXT PRIMARY KEY,
  "nfeId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL DEFAULT '',
  "descricao" TEXT NOT NULL DEFAULT '',
  "ncm" TEXT NOT NULL DEFAULT '',
  "cfop" TEXT NOT NULL DEFAULT '',
  "unidade" TEXT NOT NULL DEFAULT '',
  "quantidade" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "valorUnitario" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "valorTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
  CONSTRAINT "bi_nfe_itens_nfeId_fkey" FOREIGN KEY ("nfeId") REFERENCES "bi_nfes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "bi_nfe_itens_nfeId_idx" ON "bi_nfe_itens"("nfeId");
CREATE INDEX IF NOT EXISTS "bi_nfe_itens_codigo_idx" ON "bi_nfe_itens"("codigo");
