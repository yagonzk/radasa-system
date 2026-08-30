# V33.28 — Correção de valores decimais no Acerto de Viagens

## Problema corrigido
Na importação XLSX do Acerto de Viagens, valores numéricos com ponto decimal podiam ser convertidos para texto pelo SheetJS e depois interpretados como milhar no backend. Exemplo real: `385.60` podia acabar gravado como `3856`/valor inflado.

## Alterações
- A leitura XLSX agora usa `raw: true`, preservando células numéricas como `Number`.
- O parser monetário do backend agora aceita corretamente:
  - `385,60`
  - `R$ 385,60`
  - `385.60`
  - `385.6`
  - `3.856,00`
  - `3,856.00`
- A correção vale para Diária, Chapa e Pedágio importados.
- Não há alteração de banco nem migration.

## Para corrigir valores já gravados incorretamente
Após publicar a V33.28, reimporte a planilha de acerto preenchida. A importação sobrescreve Diária/Chapa/Pedágio das viagens correspondentes e remove lançamentos TruckPag do mesmo tipo antes de salvar, evitando soma dupla.
