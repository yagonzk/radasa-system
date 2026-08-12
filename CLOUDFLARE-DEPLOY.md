# Deploy Cloudflare — Radasa

Este projeto foi preparado para Cloudflare Workers mantendo o banco PostgreSQL existente.

## Banco de dados

Não execute seed, reset ou criação de um banco novo. O Worker deve usar a MESMA `DATABASE_URL` do ambiente atual.

## Secrets obrigatórios

```powershell
pnpm exec wrangler secret put DATABASE_URL
pnpm exec wrangler secret put JWT_SECRET
pnpm exec wrangler secret list
```

`DATABASE_URL` e `JWT_SECRET` não devem ser colocados no `wrangler.jsonc` ou enviados ao GitHub.

## Build e deploy

```powershell
pnpm install
pnpm run check
pnpm run deploy
```

O script `deploy` executa o build Cloudflare e depois `wrangler deploy`.

## Logs em produção

```powershell
pnpm exec wrangler tail
```

## Domínio

O Worker está preparado para `radasa.com.br` e `www.radasa.com.br`. Adicione o domínio em Workers & Pages > radasa-system > Settings > Domains & Routes > Custom Domain.

## Segurança

`AUTH_REQUIRED=true` fica definido no ambiente de produção. Não remova essa variável.
