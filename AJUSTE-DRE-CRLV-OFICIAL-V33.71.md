# V33.71 — DRE sem custo extra + leitura de CRLV oficial SENATRAN

## DRE Operacional
- `valorCustoExtra` continua existindo no Acerto/Fechamento de Viagem.
- O campo não compõe mais despesas automáticas do DRE Operacional.
- Também foi removido do rateio/resultado por veículo, cliente, viagem e custos por veículo dentro da análise do DRE.
- A rentabilidade própria da viagem continua mostrando o custo extra, pois a alteração solicitada é exclusiva do DRE Operacional.

## CRLV-e
- Parser adaptado ao CRLV-e oficial SENATRAN/DETRAN em que a camada textual pode trazer todos os rótulos primeiro e os valores depois.
- Fallback oficial identifica placa, RENAVAM, chassi, exercício, ano de fabricação, ano/modelo, marca/modelo, cor, combustível, proprietário e subcategoria.
- O formato tradicional de rótulo seguido de valor continua suportado.
- Referência de regressão: CRLV Digital da placa RAU3I63 fornecido pelo usuário.

## Banco
- Sem migration nova.
