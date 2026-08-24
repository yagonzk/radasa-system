# TMS — Fase 3.2: Rentabilidade por Viagem

## Alterações

- Viagens agora podem ter um cliente vinculado.
- Lançamentos financeiros podem ser vinculados a viagem, veículo e cliente pela tela Financeiro > Visão Geral.
- Ao selecionar uma viagem em um lançamento, o sistema preenche automaticamente o veículo pela placa e o cliente cadastrado na viagem.
- Detalhes da viagem carregam uma visão de rentabilidade com:
  - receita do frete;
  - receitas financeiras adicionais vinculadas;
  - combustível lançado na viagem;
  - pedágio;
  - diária;
  - chapa;
  - despesas financeiras vinculadas;
  - custo total;
  - lucro;
  - margem;
  - custo por KM;
  - lucro por KM.
- Lançamentos cancelados não entram na rentabilidade.
- Corrigido o tratamento de updates parciais no Financeiro para não limpar vínculos/datas ao dar baixa em uma conta.

## Migration

`20260824144500_add_rentabilidade_viagens`

## Atualização

```powershell
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
```
