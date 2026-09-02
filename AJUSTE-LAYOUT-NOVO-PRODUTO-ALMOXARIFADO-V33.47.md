# V33.47 — Layout do Novo Produto do Almoxarifado

## Alterado
- Modal ampliado para até 1040px, com rolagem vertical em telas menores.
- Nome do produto e Valor unitário lado a lado no topo.
- Categoria e Subcategoria lado a lado, mantendo os botões `+`.
- Quantidade, Data de compra e Código interno organizados em uma linha auxiliar.
- Observação convertida em área ampla de texto (até 500 caracteres).
- XML da NF-e e PDF ganharam áreas grandes de arrastar e soltar.
- Upload continua disponível também pelo botão `Selecionar arquivo`.
- O XML continua preenchendo automaticamente nome, quantidade, valor unitário e data de compra.
- A lógica existente de cadastro, anexos e integração com DRE foi preservada.

## Testes executados
- `node scripts/test-almoxarifado-modal-v3347.mjs`
- `node scripts/test-almoxarifado-compras-v3346.mjs`
- regressões de XML/Abastecimentos/Romaneios existentes.

## Observação do ambiente de validação
`pnpm` e `node_modules` não estão disponíveis no container de validação, portanto o `pnpm run check` e o build completo devem ser executados no ambiente Windows do projeto antes do deploy.
