# V33.21 — Correção do botão Registrar acerto

## Causa
Na V33.19 a tag de Custo Extra foi removida da interface e o estado `custoExtraTag` deixou de existir, porém `resetForm()` e a leitura de manifesto ainda chamavam `setCustoExtraTag("")`.
Ao clicar em **Registrar acerto**, `resetForm()` executava e gerava `ReferenceError`, impedindo a abertura do modal.

## Correção
- Removidas as chamadas órfãs a `setCustoExtraTag`.
- Mantido `custoExtraTag: ""` apenas no payload para compatibilidade com o backend/banco existente.
- Nenhuma migration necessária.
