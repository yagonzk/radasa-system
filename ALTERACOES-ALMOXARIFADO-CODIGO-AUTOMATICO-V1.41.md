# ALTERAÇÕES — ALMOXARIFADO V1.41

## Código automático de produtos
- Todo novo produto criado no Almoxarifado recebe código interno automático no padrão `RAD-00001`.
- A sequência continua como `RAD-00002`, `RAD-00003` e assim por diante.
- O próximo número é calculado somente a partir dos produtos do próprio Almoxarifado.
- Produtos da aba Cadastros não participam da sequência.
- O campo Código interno não pode mais ser digitado manualmente.
- Depois de criado, o código permanece imutável.
- Foi adicionado lock transacional no PostgreSQL para impedir códigos repetidos em cadastros simultâneos.

## Banco de dados
- Não há nova tabela nem coluna.
- Não é necessária migration nesta versão.
