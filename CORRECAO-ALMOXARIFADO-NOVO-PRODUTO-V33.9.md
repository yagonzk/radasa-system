# Correção Almoxarifado — Novo Produto V33.9

- Corrigido erro interno ao cadastrar novo produto no Almoxarifado.
- Removida a chamada `pg_advisory_xact_lock(...)` do fluxo de criação, pois o retorno PostgreSQL `void` pode falhar na desserialização via Prisma/Neon.
- Mantida a geração automática sequencial `RAD-00001`, `RAD-00002`, ... dentro da transação.
- Nenhuma migration nova é necessária.
