ALTER TABLE "locais"
ADD COLUMN IF NOT EXISTS "uf" VARCHAR(2);

-- Compatibilidade com os cadastros antigos:
-- pela nova regra, R$ 300,00 é reservado aos destinos do Pará.
UPDATE "locais"
SET "uf" = 'PA'
WHERE "uf" IS NULL
  AND "valorComissao" = 300.00
  AND LOWER(TRIM("cidade")) <> 'colniza';

-- Reaplica a nova tabela fixa de comissão nos locais existentes.
UPDATE "locais"
SET "valorComissao" = CASE
  WHEN LOWER(TRIM(REGEXP_REPLACE("cidade", '\s*[/,-]\s*[A-Za-z]{2}\s*$', ''))) = 'colniza' THEN 350.00
  WHEN UPPER(COALESCE("uf", '')) = 'PA' THEN 300.00
  ELSE 275.00
END;

CREATE INDEX IF NOT EXISTS "locais_uf_idx"
ON "locais"("uf");
