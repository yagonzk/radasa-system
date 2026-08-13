-- Separa completamente os produtos do Estoque dos produtos da aba Cadastros.
-- Os produtos que já possuem movimentação são copiados para a nova tabela
-- para preservar todo o histórico de entradas e saídas existente.

CREATE TABLE "estoque_produtos" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "codigoInterno" TEXT NOT NULL,
  "categoria" TEXT NOT NULL DEFAULT 'Produtos de Piscina',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "estoque_produtos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "estoque_produtos_nome_idx" ON "estoque_produtos"("nome");
CREATE INDEX "estoque_produtos_codigoInterno_idx" ON "estoque_produtos"("codigoInterno");
CREATE INDEX "estoque_produtos_categoria_idx" ON "estoque_produtos"("categoria");

INSERT INTO "estoque_produtos" ("id", "nome", "codigoInterno", "categoria", "createdAt", "updatedAt")
SELECT DISTINCT
  p."id",
  p."nome",
  p."codigoInterno",
  CASE
    WHEN lower(trim(p."categoriaEstoque")) IN ('peça', 'peças', 'peca', 'pecas', 'peca(s)', 'peça(s)') THEN 'Peças'
    WHEN lower(trim(p."categoriaEstoque")) IN ('ferramenta', 'ferramentas') THEN 'Ferramentas'
    ELSE 'Produtos de Piscina'
  END,
  p."createdAt",
  p."updatedAt"
FROM "produtos" p
WHERE EXISTS (
  SELECT 1
  FROM "estoque_movimentacoes" em
  WHERE em."produtoId" = p."id"
);

ALTER TABLE "estoque_movimentacoes"
  DROP CONSTRAINT IF EXISTS "estoque_movimentacoes_produtoId_fkey";

ALTER TABLE "estoque_movimentacoes"
  ADD CONSTRAINT "estoque_movimentacoes_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "estoque_produtos"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
