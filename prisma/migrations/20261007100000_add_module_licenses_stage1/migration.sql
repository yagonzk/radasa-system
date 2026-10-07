CREATE TABLE "module_licenses" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "unlimited" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "module_licenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "module_licenses_userId_module_key" ON "module_licenses"("userId", "module");
CREATE INDEX "module_licenses_module_active_expiresAt_idx" ON "module_licenses"("module", "active", "expiresAt");

ALTER TABLE "module_licenses"
  ADD CONSTRAINT "module_licenses_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Compatibilidade com as contas que já utilizavam o TMS antes do licenciamento.
-- Somente usuários já ativos recebem Transportes ilimitado na migração inicial.
INSERT INTO "module_licenses" (
  "id", "userId", "module", "active", "unlimited", "expiresAt", "createdAt", "updatedAt"
)
SELECT
  'lic_' || md5(u."id" || clock_timestamp()::text || random()::text),
  u."id",
  'TRANSPORTES',
  true,
  true,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE u."active" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "module_licenses" ml
    WHERE ml."userId" = u."id" AND ml."module" = 'TRANSPORTES'
  );
