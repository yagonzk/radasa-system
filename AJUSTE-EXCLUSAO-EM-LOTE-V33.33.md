# Radasa System V33.33 — Exclusão em lote

## Abastecimentos
- Checkbox em cada linha.
- Checkbox no cabeçalho seleciona/desmarca a página atual.
- Barra de ação aparece quando existem itens selecionados.
- Exclusão em lote usa uma única chamada ao backend.

## Romaneios
- Mesmo fluxo de seleção e exclusão em lote.

## Backend
- POST /api/abastecimentos/excluir-lote
- POST /api/manifestos/excluir-lote
- Até 500 IDs por operação.
- Exclusão dos registros filhos e pais dentro de transação Prisma.
- Uma única invalidação/atualização da interface ao final do lote.

Objetivo: evitar rajadas de dezenas/centenas de DELETEs individuais contra Cloudflare/Neon e reduzir timeouts/erros 5xx ao excluir muitos registros.
