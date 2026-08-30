ALTER TABLE "sefaz_sync_state"
  ADD COLUMN IF NOT EXISTS "forceRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "agentLastSeenAt" TIMESTAMP(3);
