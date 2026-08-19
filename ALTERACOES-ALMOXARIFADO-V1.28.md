# ALTERAÇÕES — ALMOXARIFADO V1.28

## Nova movimentação
- O botão **Nova movimentação** passa a servir exclusivamente para lançar **Entrada** ou **Saída** de um produto já cadastrado.
- Ao clicar, o formulário de movimentação permite selecionar:
  - tipo: Entrada ou Saída;
  - produto já cadastrado;
  - data;
  - quantidade;
  - valor unitário;
  - observações;
  - nota fiscal em PDF, opcional.
- Se não houver produto cadastrado, o sistema apenas informa que é necessário usar o botão **Novo produto**.
- O botão **Nova movimentação** não abre mais a tela de cadastro de produto automaticamente.
- Se o filtro de tipo de produto estiver selecionado e não houver produto naquela categoria, o sistema orienta alterar o filtro ou cadastrar o produto separadamente.

## Banco de dados
- Nenhuma migration nova.
- Alteração somente de fluxo/interface do Almoxarifado.
