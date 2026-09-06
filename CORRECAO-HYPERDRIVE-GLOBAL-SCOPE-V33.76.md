# Correção Hyperdrive no Cloudflare — V33.76

## Problema corrigido

A V33.75 lia `env.HYPERDRIVE.connectionString` por meio de `cloudflare:workers` no escopo global do módulo. O Cloudflare Workers rejeita esse acesso com erro 10021 (`Disallowed operation called within global scope`) porque a resolução do binding Hyperdrive pode envolver I/O e só pode ocorrer dentro de um handler.

## Solução

- `worker/index.ts` não importa mais `env` de `cloudflare:workers`.
- O binding `HYPERDRIVE` é lido somente dentro de `fetch()`.
- `server/lib/runtime-bindings.ts` mantém `connectionString` e `RESEND_API_KEY` em `AsyncLocalStorage`, isolados por request.
- `server/lib/prisma.ts` resolve a URL do Hyperdrive a partir desse contexto request-scoped e mantém `DATABASE_URL` apenas como fallback local/Node.
- O serviço de e-mail também usa o binding request-scoped, removendo a dependência de segredo mutável em `globalThis`.
- Todas as proteções de concorrência e estabilidade da V33.75 foram preservadas.

## Validação esperada

Com o binding `HYPERDRIVE` presente no `wrangler.jsonc`, `wrangler deploy` não deve mais falhar por acesso a I/O no escopo global. Depois do deploy, as rotas `/api` que acessam Prisma recebem a URL do Hyperdrive dentro do contexto da própria requisição.
