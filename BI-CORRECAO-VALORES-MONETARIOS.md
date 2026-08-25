# BI — correção de valores monetários

Correções aplicadas:
- Tooltip de Faturamento e Frete agora usa moeda brasileira: `R$ 0,00`.
- O Frete Total de cada item passa a ser calculado prioritariamente por `quantidade × valor unitário do frete do Romaneio`.
- `valorTotal` permanece como fallback apenas quando o valor unitário não estiver disponível.
- Percentuais continuam formatados como `%`.
- Nenhuma migration foi criada.

## Publicação
```powershell
pnpm install
pnpm exec prisma generate
pnpm run check
pnpm run deploy:cloudflare
```

## Git
```powershell
git add .
git commit -m "fix: corrige valores monetarios do BI"
git push origin main
```
