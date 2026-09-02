ALTER TABLE "estoque_produtos" ADD COLUMN IF NOT EXISTS "subcategoria" TEXT NOT NULL DEFAULT '';
ALTER TABLE "estoque_movimentacoes" ADD COLUMN IF NOT EXISTS "xmlUrl" TEXT;
ALTER TABLE "estoque_movimentacoes" ADD COLUMN IF NOT EXISTS "xmlName" TEXT;
CREATE TABLE IF NOT EXISTS "estoque_subcategorias" ("id" TEXT NOT NULL, "nome" TEXT NOT NULL, "categoria" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "estoque_subcategorias_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX IF NOT EXISTS "estoque_subcategorias_categoria_nome_key" ON "estoque_subcategorias"("categoria", "nome");
CREATE INDEX IF NOT EXISTS "estoque_subcategorias_categoria_idx" ON "estoque_subcategorias"("categoria");
