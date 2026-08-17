-- Tipos de produto próprios do Almoxarifado.
-- Não possui vínculo com a tabela "produtos" usada na aba Cadastros.
CREATE TABLE IF NOT EXISTS "estoque_tipos_produto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "estoque_tipos_produto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "estoque_tipos_produto_nome_key"
ON "estoque_tipos_produto"("nome");

CREATE INDEX IF NOT EXISTS "estoque_tipos_produto_nome_idx"
ON "estoque_tipos_produto"("nome");

-- Tipos iniciais já existentes no módulo.
INSERT INTO "estoque_tipos_produto" ("id", "nome", "createdAt", "updatedAt")
VALUES
  ('tipo_produtos_piscina', 'Produtos de Piscina', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tipo_pecas', 'Peças', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tipo_ferramentas', 'Ferramentas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("nome") DO NOTHING;

-- Preserva qualquer categoria já usada por produtos antigos do Almoxarifado.
INSERT INTO "estoque_tipos_produto" ("id", "nome", "createdAt", "updatedAt")
SELECT
  'tipo_legacy_' || md5(trim("categoria")),
  trim("categoria"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "estoque_produtos"
WHERE trim(COALESCE("categoria", '')) <> ''
GROUP BY trim("categoria")
ON CONFLICT ("nome") DO NOTHING;
