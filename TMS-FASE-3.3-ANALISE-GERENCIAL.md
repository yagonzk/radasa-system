# TMS Fase 3.3 — Análise Gerencial de Rentabilidade

## Adicionado
- Endpoint `/api/financeiro/analise/rentabilidade`.
- Ranking de rentabilidade por caminhão.
- Ranking de rentabilidade por cliente.
- Ranking de rentabilidade por viagem.
- Receita, custos, resultado, margem, custo/km e lucro/km.
- Destaque automático de melhor e menor resultado.
- Respeita o filtro de período da Visão Geral Financeira.
- Lançamentos manuais vinculados a viagem/veículo/cliente entram nos respectivos rankings.

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
git commit -m "feat: adiciona analise gerencial de rentabilidade"
git push origin main
```

Não há nova migration nesta etapa.
