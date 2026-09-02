# V33.42 - Alinhamento do relatório de Romaneios

Corrige o desalinhamento das colunas monetárias no relatório Resumo de Romaneios.

## Causa
A coluna PLACA usa `rowspan="3"`. Nas linhas CLIENTE e TOTAL existem apenas quatro `<td>`, então o seletor `td:nth-child(n+3)` passava a apontar para colunas lógicas diferentes.

## Correção
- Mantém a grade/colgroup fixa.
- Remove a dependência de `nth-child` para células monetárias.
- Aplica `class="amount-cell"` explicitamente nas colunas 1ª quinzena, 2ª quinzena e Total em todas as linhas.
- Preserva cálculos e valores do relatório.

## Teste
Execute:

```powershell
node scripts/test-romaneios-report-alignment.mjs
```
