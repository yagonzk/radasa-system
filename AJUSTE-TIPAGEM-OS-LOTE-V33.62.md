# V33.62 - Correção de tipagem na conclusão de OS em lote

Corrige o erro TypeScript em `server/services/manutencao.service.ts` no método `concluirOsLote`.

O array de IDs agora é explicitamente normalizado como `string[]` antes de ser enviado ao filtro Prisma `id: { in: ids }`.

Não há alteração de regra de negócio e não há migração de banco nesta versão.
