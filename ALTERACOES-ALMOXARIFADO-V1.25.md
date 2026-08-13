# ALTERAÇÕES — ALMOXARIFADO V1.25

## Simplificação da tela
- A aba principal continua com o nome **Almoxarifado**.
- Foram removidas as abas superiores separadas por tipo de produto.
- Agora existem somente as três visualizações internas:
  - **Estoque**
  - **Entrada**
  - **Saída**
- Foi adicionado um filtro **Tipo de produto** com:
  - Todos os tipos
  - Produtos de Piscina
  - Peças
  - Ferramentas
- O filtro afeta os totais, a tabela de estoque, entradas, saídas e exportações.
- Ao registrar uma movimentação, a lista de produtos respeita o filtro selecionado.
- Ao cadastrar um novo produto, o tipo continua sendo escolhido no formulário.

## Banco de dados
- Nenhuma migration nova foi criada.
- Atualização somente de interface/lógica do frontend.
