# Viagens — Importação TruckPag (Pedágios e Chapas)

## O que foi adicionado
Na aba **Viagens** existe agora o botão **Importar pedágios/chapas**.

O sistema aceita um ou vários CSVs exportados pelo TruckPag e:

1. lê arquivos UTF-16/UTF-8;
2. considera apenas lançamentos de saída;
3. classifica Pedágio, Chapa ou ignora o lançamento;
4. procura o motorista pelo colaborador do extrato;
5. vincula pela data à viagem mais recente daquele motorista iniciada até 10 dias antes;
6. mostra uma tela de revisão antes de gravar;
7. permite escolher manualmente outra viagem quando não houver vínculo automático;
8. impede importação duplicada pelo fingerprint do lançamento;
9. soma os valores importados aos custos da viagem e à rentabilidade;
10. mantém o valor manual de Pedágio/Chapa separado do valor vindo do TruckPag.

## Regras confirmadas para estes extratos

### Chapa
- PIX de R$ 150,00, R$ 300,00 ou R$ 600,00.
- O PIX de **R$ 248,00 é ignorado**.

### Pedágio
- Concessionárias e estabelecimentos conhecidos, incluindo VIA BRASIL, VIANORTESUL, APASI e similares.
- Valores baixos (até R$ 60,00), quando o lançamento não é claramente combustível, restaurante, pneus, transferência, hotel, oficina etc.

## Cruzamento dos arquivos fornecidos
Dos dois extratos analisados:

- **145 lançamentos de Pedágio** — R$ 5.154,20
- **18 lançamentos de Chapa** — R$ 10.800,00
- **163 lançamentos classificados no total**
- Pelo arquivo 2026.zip, **147 puderam ser associados automaticamente a uma viagem de referência**.
- **16 ficaram para revisão**, principalmente porque o arquivo de viagens disponibilizado termina em 07/08 enquanto o extrato possui movimentos de 19/08, 20/08 e 24/08.

Após o deploy, se essas viagens posteriores já existirem no Radasa System, o próprio importador poderá vinculá-las automaticamente ou você poderá selecioná-las na revisão.

## Arquivos de conferência
- `dados/TRUCKPAG_2026_RECONCILIACAO.csv`
- `dados/TRUCKPAG_2026_RESUMO_POR_VIAGEM.csv`

## Migration
`20260825161000_add_viagem_despesas_extrato`

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
git commit -m "feat: integra pedagios e chapas TruckPag nas viagens"
git push origin main
```
