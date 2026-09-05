# V33.63 — Almoxarifado: NF-e com vários itens

## O que mudou
- O XML de uma NF-e agora pode conter vários `<det>` e todos aparecem numa prévia antes da importação.
- Cada item pode ser incluído/ignorado, renomeado e classificado com categoria/subcategoria própria.
- Produto novo recebe novo código sequencial `RAD-xxxxx`.
- Produto já existente recebe nova entrada e a quantidade é somada ao estoque.
- A identificação prioriza código do fornecedor + CNPJ/CPF e usa nome/NCM como compatibilidade para cadastros antigos.
- O fornecedor da NF-e é localizado pelo CNPJ/CPF ou cadastrado automaticamente com os dados do emitente.
- A visualização do produto destaca os fornecedores e o histórico mostra fornecedor e NF-e.
- A chave da NF-e é única no Almoxarifado, bloqueando importação duplicada.
- XML/PDF da nota são armazenados uma única vez por NF-e; os itens apenas referenciam a nota para evitar duplicar Base64 no banco.

## Banco de dados
Migration: `20260905133000_almoxarifado_nfe_multiplos_itens`.

Novos dados:
- `estoque_produtos.ncm`
- tabela `estoque_notas_fiscais`
- `estoque_movimentacoes.notaFiscalId`
- `estoque_movimentacoes.codigoFornecedor`
- `estoque_movimentacoes.unidade`
