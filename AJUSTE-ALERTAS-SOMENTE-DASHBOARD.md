# Ajuste — Alertas somente na Dashboard

- A opção **Alertas** foi removida da navegação.
- A página separada `/alertas` foi removida.
- Os alertas continuam sendo exibidos na **Dashboard > Alertas Prioritários**.
- Motoristas, veículos, documentos e manutenção continuam alimentando os alertas da Dashboard.
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
git commit -m "refactor: mantem alertas somente na dashboard"
git push origin main
```
