ALTER TABLE "manifestos"
  ADD COLUMN IF NOT EXISTS "preFechamentoComissaoPaga" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "preFechamentoPedagioPago" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "preFechamentoAbastecimentoPago" BOOLEAN NOT NULL DEFAULT false;
