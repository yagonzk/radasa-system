# BI — produtos somente dos Romaneios

O filtro Produto do BI agora é montado exclusivamente a partir dos produtos que aparecem nos Romaneios.

- Produtos apenas cadastrados não aparecem no BI.
- O produto aparece quando existir em pelo menos um Romaneio.
- Código e descrição continuam sendo mostrados.
- Gráficos, tabelas e totais continuam calculados pelos Romaneios.
- Não há migration.

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
git commit -m "fix: limita produtos do BI aos romaneios"
git push origin main
```
