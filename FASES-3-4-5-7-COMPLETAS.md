# Radasa TMS — Fases 3, 4, 5 e 7

## Fase 3 — Frota, alertas, manutenção, custos e rentabilidade
- Central de Alertas em `/alertas`.
- Alertas de CNH, MOPP, toxicológico, CRLV, IPVA, licenciamento, seguro e manutenção.
- Ordens de serviço preventiva/corretiva.
- Veículo muda automaticamente para `MANUTENCAO` ao abrir OS e volta a `DISPONIVEL` ao concluir.
- Integração de peça do Almoxarifado com OS: gera saída de estoque.
- Custo da OS concluída entra no Financeiro.
- Planos preventivos por KM/data.
- Situação operacional do veículo: disponível, em viagem, manutenção ou inativo.
- Custos gerenciais por caminhão: diesel/ARLA/combustível, pedágios, diárias, chapas, pneus, manutenção/lançamentos, IPVA, licenciamento e seguro quando cadastrados.
- Rentabilidade por caminhão, cliente e viagem.

## Fase 4 — Financeiro
- Contas a receber e pagar.
- Centro de custos e DRE.
- Fluxo de caixa, vencidos e projeção 7/30 dias.
- Baixas parciais e totais.
- Saldo restante por lançamento.
- Histórico individual de baixas.
- Parcelamento automático.
- Repetição mensal/lançamento recorrente por quantidade de meses.
- Forma de pagamento, observação e link de comprovante na baixa.
- Vínculo com viagem, veículo e cliente.
- Clientes da análise são derivados dos Romaneios quando houver correspondência.
- Composição detalhada de custos por caminhão.

## Fase 5 — Gestão avançada de Viagens
- Código automático `RAD-00001`.
- Status: Planejada, Carregando, Em trânsito, Entregue, Finalizada e Cancelada.
- Origem, cidades intermediárias e destino.
- Saída, previsão de chegada e chegada real.
- KM de saída e KM de chegada.
- Distância planejada x distância real.
- Observações operacionais.
- Situação do veículo sincronizada com a viagem.
- Rentabilidade da viagem usa combustível real do período operacional quando disponível.
- Timeline e resumo financeiro na ficha da viagem.

## Fase 7 — Dashboard Gerencial
- Dashboard substituído por visão gerencial do TMS.
- Faturamento e resultado do mês.
- Viagens em andamento, KM rodado, combustível e OS abertas.
- Fluxo de caixa e projeções.
- Centralização de alertas prioritários.
- Ranking de rentabilidade por caminhão e por cliente.
- Viagens recentes e status operacional.

## Migration
`20260824190000_complete_fases_3_4_5_7`

## Atualização / publicação
```powershell
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
```

## GitHub
```powershell
git add .
git commit -m "feat: completa fases 3 4 5 e 7 do TMS"
git push origin main
```
