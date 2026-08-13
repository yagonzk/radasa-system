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
