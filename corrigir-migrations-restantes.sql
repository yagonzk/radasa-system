BEGIN;

-- ============================================================
-- 1. SUBCATEGORIA DE VEÍCULOS
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'SubcategoriaVeiculo'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE "SubcategoriaVeiculo"
        AS ENUM ('CAMINHAO', 'CARRO', 'MOTO');
    END IF;
END
$$;

ALTER TABLE "veiculos"
    ADD COLUMN IF NOT EXISTS "subcategoria" "SubcategoriaVeiculo";

CREATE INDEX IF NOT EXISTS "veiculos_subcategoria_idx"
    ON "veiculos"("subcategoria");


-- ============================================================
-- 2. NOVO CADASTRO INDEPENDENTE DE PRODUTOS DO ESTOQUE
-- ============================================================

CREATE TABLE IF NOT EXISTS "estoque_produtos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "codigoInterno" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Produtos de Piscina',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "estoque_produtos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "estoque_produtos"
    ADD COLUMN IF NOT EXISTS "nome" TEXT,
    ADD COLUMN IF NOT EXISTS "codigoInterno" TEXT,
    ADD COLUMN IF NOT EXISTS "categoria" TEXT DEFAULT 'Produtos de Piscina',
    ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "estoque_produtos_nome_idx"
    ON "estoque_produtos"("nome");

CREATE INDEX IF NOT EXISTS "estoque_produtos_codigoInterno_idx"
    ON "estoque_produtos"("codigoInterno");

CREATE INDEX IF NOT EXISTS "estoque_produtos_categoria_idx"
    ON "estoque_produtos"("categoria");


-- ============================================================
-- 3. PRESERVA OS PRODUTOS QUE JÁ POSSUEM MOVIMENTAÇÃO
-- ============================================================

INSERT INTO "estoque_produtos" (
    "id",
    "nome",
    "codigoInterno",
    "categoria",
    "createdAt",
    "updatedAt"
)
SELECT DISTINCT
    p."id",
    p."nome",
    p."codigoInterno",

    CASE
        WHEN lower(trim(COALESCE(to_jsonb(p)->>'categoriaEstoque', '')))
            IN ('peça','peças','peca','pecas','peca(s)','peça(s)')
            THEN 'Peças'

        WHEN lower(trim(COALESCE(to_jsonb(p)->>'categoriaEstoque', '')))
            IN ('ferramenta','ferramentas')
            THEN 'Ferramentas'

        ELSE 'Produtos de Piscina'
    END,

    p."createdAt",
    p."updatedAt"

FROM "produtos" p

WHERE EXISTS (
    SELECT 1
    FROM "estoque_movimentacoes" em
    WHERE em."produtoId" = p."id"
)

AND NOT EXISTS (
    SELECT 1
    FROM "estoque_produtos" ep
    WHERE ep."id" = p."id"
);


-- ============================================================
-- 4. CONFERE SE TODA MOVIMENTAÇÃO POSSUI PRODUTO
-- ============================================================

DO $$
BEGIN

    IF EXISTS (
        SELECT 1
        FROM "estoque_movimentacoes" em

        LEFT JOIN "estoque_produtos" ep
            ON ep."id" = em."produtoId"

        WHERE ep."id" IS NULL
    )
    THEN
        RAISE EXCEPTION
        'Existem movimentações de estoque sem produto correspondente. Operação cancelada para proteger os dados.';
    END IF;

END
$$;


-- ============================================================
-- 5. TROCA A RELAÇÃO DO ESTOQUE
-- produtos -> estoque_produtos
-- ============================================================

ALTER TABLE "estoque_movimentacoes"
    DROP CONSTRAINT IF EXISTS "estoque_movimentacoes_produtoId_fkey";

ALTER TABLE "estoque_movimentacoes"
    ADD CONSTRAINT "estoque_movimentacoes_produtoId_fkey"
    FOREIGN KEY ("produtoId")
    REFERENCES "estoque_produtos"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;


COMMIT;
