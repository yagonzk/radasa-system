ALTER TABLE "veiculos"
ADD COLUMN IF NOT EXISTS "motoristaId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'veiculos_motoristaId_fkey'
  ) THEN
    ALTER TABLE "veiculos"
    ADD CONSTRAINT "veiculos_motoristaId_fkey"
    FOREIGN KEY ("motoristaId")
    REFERENCES "motoristas"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "veiculos_motoristaId_idx"
ON "veiculos"("motoristaId");
