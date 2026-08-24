# Correções TypeScript - 24/08/2026

Correções aplicadas:

- `client/src/pages/Abastecimentos.tsx`
  - adicionada função `normalizePlate` para normalização de placas usada nos filtros.
- `client/src/pages/Fiscal.tsx`
  - ajustado `despesasRows.map` para respeitar a inferência de tuplas `readonly` do TypeScript.
- `server/controllers/fiscal.controller.ts`
  - normalizado `req.params.id` de `string | string[]` para `string` antes de chamar o service.

Validação local recomendada:

```powershell
pnpm run check
```

Depois, para publicar:

```powershell
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run deploy:cloudflare
```
