# V33.66 — Movimentações do Almoxarifado

## Alterações
- Entrada e Saída agora têm pesquisa geral e filtros por coluna no padrão do Romaneios.
- O seletor de produto da Nova movimentação permite digitar nome, código, categoria ou subcategoria.
- A data da movimentação usa campo digitável (`type=date`), mantendo seleção pelo navegador.
- Em Saída, somente produtos com saldo maior que zero aparecem no seletor.
- Ao selecionar um produto para Saída, o saldo atual é exibido e usado como limite máximo da quantidade.
- A tela impede digitar quantidade de saída maior que o saldo disponível; o backend continua validando saldo para impedir estoque negativo.
- Ao excluir uma Entrada, seu efeito é retirado do saldo; a exclusão é bloqueada se isso deixar o estoque negativo.
- Ao excluir uma Saída, a quantidade é automaticamente devolvida ao saldo, pois o estoque é calculado pelas movimentações existentes.
- A exclusão agora exibe confirmação explicando a reversão do saldo.

## Banco de dados
Nenhuma migração nova.
