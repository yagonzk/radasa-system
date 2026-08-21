-- Adiciona o campo ARO ao cadastro de pneus sem alterar dados existentes.
ALTER TABLE "pneus"
ADD COLUMN IF NOT EXISTS "aro" VARCHAR(40);
