# Radasa System V33.38 - Romaneios: marcar selecionados como pagos

## Alteração

- Adicionado o botão **Marcar como pagos** na barra exibida quando um ou mais romaneios são selecionados.
- A ação considera somente itens cuja cobrança é **Receber c/ Cliente**.
- Itens já pagos são ignorados.
- A atualização é enviada em pequenos lotes para evitar excesso de requisições simultâneas.
- Ao concluir, a listagem é recarregada para atualizar os cards **Foi pago** e **Falta pagar**.
- Em caso de falha parcial, os romaneios permanecem selecionados para permitir uma nova tentativa.

## Arquivos alterados

- `client/src/pages/Romaneios.tsx`
- `client/src/lib/romaneioGrouping.ts`
- `client/src/lib/romaneioGrouping.test.ts`
