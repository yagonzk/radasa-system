# V33.39 - Correção ReferenceError em Abastecimentos

Corrigido o erro `ReferenceError: item is not defined` na tela de Abastecimentos.

## Ajustes
- O resumo de valor unitário do Diesel agora soma o valor líquido do Diesel por abastecimento antes de calcular a média do período.
- O filtro de "Valor unitário Diesel" mantém cada `item` no mesmo escopo em que o desconto é calculado.
- Mantido o desconto por abastecimento no cálculo do valor unitário do Diesel.
- Adicionado teste de regressão em `scripts/test-abastecimentos-item-scope.mjs` para impedir que `item` volte a ser usado fora do escopo nesses dois trechos.

## Verificação
Execute:

```powershell
node scripts/test-abastecimentos-item-scope.mjs
pnpm run check
```
