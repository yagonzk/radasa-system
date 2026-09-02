# V33.50 — Filtros integrados na tabela do Almoxarifado

## Alterações
- Removidos os filtros grandes de Tipo de produto, Produto e Subcategoria que ficavam ao lado das abas Estoque/Entrada/Saída.
- Mantida uma busca geral compacta, alinhada à esquerda, para pesquisar por nome ou código do produto.
- Adicionadas as colunas Tipo de produto e Subcategoria diretamente na tabela de Estoque.
- Produto, Tipo de produto e Subcategoria agora podem ser filtrados diretamente pelo cabeçalho da tabela.
- Cada filtro de cabeçalho permite digitar para pesquisar uma opção ou selecionar manualmente na lista.
- Mantidos Código, Entradas, Saídas, Saldo, Valor das saídas e Ações.
- Nova movimentação passa a listar todos os produtos, sem depender de um filtro externo removido.

## Compatibilidade
- Não altera banco de dados, migrations, API ou regras de cálculo do estoque.
- Cadastro/edição de tipos, subcategorias e produtos permanecem disponíveis nos fluxos existentes.
