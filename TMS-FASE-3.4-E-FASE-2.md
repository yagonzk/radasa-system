# TMS — Fase 3.4 + Fase 2

## Fase 3.4 — Fluxo de Caixa
- Baixas parciais de contas a pagar/receber.
- Histórico persistente de baixas no banco.
- Saldo realizado.
- Valores vencidos a pagar e receber.
- Previsão de caixa para 7 e 30 dias.
- Projeção de saldo.
- Pagamentos/recebimentos parciais não quitam a conta até atingir o valor total.

## Fase 2 — Frota e Manutenção
- Nova área Frota > Manutenção.
- Ordens de Serviço preventiva/corretiva.
- Custos de peças, mão de obra e outros.
- Conclusão de OS envia automaticamente a despesa para o Financeiro.
- Planos de manutenção preventiva por KM/data.
- Alertas de manutenção próxima.
- Documentos da frota e alertas de vencimento.
- Painel de OS abertas, planos ativos, alertas e custo acumulado.
- Pneus ganhou acesso próprio dentro do grupo Frota.

## Migration
`20260824161000_add_fluxo_caixa_manutencao`

## Atualizar e publicar
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
git commit -m "feat: adiciona fluxo de caixa e gestao de manutencao"
git push origin main
```
