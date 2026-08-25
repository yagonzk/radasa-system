# Correção do build do BI

Corrigidos os imports ausentes de:
- `LoaderCircle`
- `Upload`

Arquivo:
`client/src/pages/BIGerencial.tsx`

Não há migration nova.

## Testar
```powershell
pnpm exec prisma generate
pnpm run check
```

## Publicar
```powershell
pnpm run deploy:cloudflare
```
