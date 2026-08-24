# TMS Fase 3 — Financeiro, Centro de Custos e DRE

Implementado:
- Nova subaba Financeiro > Visão Financeira.
- Contas a pagar e contas a receber.
- Lançamentos de receitas e despesas com competência, vencimento, forma de pagamento, categoria e centro de custo.
- Baixa de contas como PAGO/RECEBIDO.
- Centros de custo persistidos no PostgreSQL.
- DRE gerencial consolidando lançamentos manuais com dados já existentes de Viagens, Pedágios, Diárias, Chapas, Abastecimentos, Comissões, Almoxarifado, Pneus, Recapagens e Consertos.
- Filtros por período.

Migration: `20260824132000_add_financeiro_fase3`.

## Publicação
```powershell
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
```

## Git
```powershell
git add .
git commit -m "feat: adiciona fase 3 financeiro centro de custos e DRE"
git push origin main
```
