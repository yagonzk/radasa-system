# V33.65 - Timeout na importação de NF-e do Almoxarifado

## Correção

- A importação de NF-e com vários itens não depende mais do timeout padrão de 5 segundos do Prisma.
- A transação interativa de `importarNfe` agora usa `maxWait: 10_000` e `timeout: 60_000`.
- Validação de categorias e subcategorias foi retirada de dentro da transação e é feita antes da gravação atômica.
- Categorias e subcategorias são carregadas uma única vez para validação em memória, reduzindo consultas durante a importação.
- A atomicidade foi mantida: fornecedor, nota fiscal, produtos e movimentações continuam sendo gravados na mesma transação.

## Banco de dados

Não há nova migration nesta versão.
