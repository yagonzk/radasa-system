# Ajuste de navegação — Alertas

- **Alertas** foi removido do grupo **Operação**.
- **Alertas** agora fica dentro de **Cadastros**.
- A página e a rota `/alertas` foram mantidas; somente a organização do menu mudou.
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
git commit -m "refactor: move alertas para cadastros"
git push origin main
```
