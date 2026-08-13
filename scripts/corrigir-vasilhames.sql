-- Radasa: classificação VASILHAME (seguro/aditivo)
-- Não remove tabelas, colunas nem registros. Pode ser executado mais de uma vez.

ALTER TYPE "TipoManifesto" ADD VALUE IF NOT EXISTS 'VASILHAME';

-- Corrige itens já lançados cujo cadastro de produto é vasilhame.
UPDATE "manifesto_produtos" AS mp
SET "tipoManifesto" = 'VASILHAME'::"TipoManifesto"
FROM "produtos" AS p
WHERE mp."produtoId" = p."id"
  AND (
    UPPER(p."nome") LIKE '%VASILHAME%' OR
    UPPER(p."nome") LIKE '%VASILAME%' OR
    UPPER(p."nome") LIKE '%VASILEAME%'
  )
  AND mp."tipoManifesto" IS DISTINCT FROM 'VASILHAME'::"TipoManifesto";

-- Se um romaneio contiver somente vasilhames, ajusta também o tipo principal.
UPDATE "manifestos" AS m
SET "tipoManifesto" = 'VASILHAME'::"TipoManifesto"
WHERE EXISTS (
  SELECT 1 FROM "manifesto_produtos" mp WHERE mp."manifestoId" = m."id"
)
AND NOT EXISTS (
  SELECT 1 FROM "manifesto_produtos" mp
  WHERE mp."manifestoId" = m."id"
    AND COALESCE(mp."tipoManifesto", m."tipoManifesto") <> 'VASILHAME'::"TipoManifesto"
);
