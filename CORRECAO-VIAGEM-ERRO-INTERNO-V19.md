# Correção V19 — Viagem sem cliente

O formulário já havia removido Cliente da Viagem, mas o banco de produção podia continuar com `viagens.clienteId` como NOT NULL.
Ao editar/salvar, o backend envia `clienteId = null`, causando erro interno do Prisma/PostgreSQL.

## Correção
- migration torna `viagens.clienteId` nullable;
- placa e motorista continuam independentes;
- timeline operacional continua opcional.

## Publicação
```powershell
pnpm install
pnpm exec prisma migrate deploy
pnpm run build:cloudflare
pnpm run deploy
```
