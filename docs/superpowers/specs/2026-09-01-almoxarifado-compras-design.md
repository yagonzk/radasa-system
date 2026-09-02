# Almoxarifado — Compras e integração DRE

## Objetivo
Transformar o cadastro de produto do Almoxarifado em um fluxo de compra: nome, quantidade, valor unitário, data da compra, categoria, subcategoria, observação, XML e PDF.

## Regras
- Categoria e subcategoria são cadastráveis por botão `+`, sem sair do formulário.
- Subcategoria pertence a uma categoria.
- Ao cadastrar um produto novo com compra, criar automaticamente uma movimentação ENTRADA pelo total quantidade × valor unitário.
- O DRE Operacional usa a categoria escolhida no produto para classificar a despesa da entrada, em vez da categoria genérica "Almoxarifado".
- XML de NF-e pode preencher automaticamente nome, quantidade, valor unitário e data; o usuário confere antes de salvar.
- XML e PDF ficam anexados à movimentação de entrada.
- Cadastro manual continua permitido.
- Código RAD-xxxxx continua automático.
