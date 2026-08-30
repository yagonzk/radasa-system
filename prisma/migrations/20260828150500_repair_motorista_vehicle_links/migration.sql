-- V33.16: reparo não destrutivo dos vínculos motorista/veículo.
-- As viagens já possuem motoristaId NOT NULL + FK para motoristas, portanto seus vínculos são preservados.
-- Para veículos cujo motoristaId ficou NULL, restaura pelo motorista da viagem mais recente da mesma placa.
WITH latest_trip AS (
  SELECT DISTINCT ON (regexp_replace(upper(vg."placa"), '[^A-Z0-9]', '', 'g'))
    regexp_replace(upper(vg."placa"), '[^A-Z0-9]', '', 'g') AS plate_key,
    vg."motoristaId"
  FROM "viagens" vg
  WHERE COALESCE(vg."motoristaId", '') <> ''
    AND COALESCE(vg."placa", '') <> ''
  ORDER BY regexp_replace(upper(vg."placa"), '[^A-Z0-9]', '', 'g'), vg."dataManifesto" DESC, vg."createdAt" DESC
)
UPDATE "veiculos" v
SET "motoristaId" = lt."motoristaId"
FROM latest_trip lt
WHERE v."motoristaId" IS NULL
  AND regexp_replace(upper(v."placa"), '[^A-Z0-9]', '', 'g') = lt.plate_key
  AND EXISTS (SELECT 1 FROM "motoristas" m WHERE m."id" = lt."motoristaId");
