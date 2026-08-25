$ErrorActionPreference = "Stop"
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
