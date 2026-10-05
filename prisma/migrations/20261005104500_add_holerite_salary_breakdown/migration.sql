ALTER TABLE "fechamentos"
ADD COLUMN IF NOT EXISTS "salarioFixo" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "valorComissoes" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Preserva fechamentos históricos: o valor antigo continua sendo tratado como comissão.
UPDATE "fechamentos"
SET "valorComissoes" = "valorTotal"
WHERE "valorComissoes" = 0;
