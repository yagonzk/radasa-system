# Correções Cloudflare v1.6

Esta versão preserva o schema e os dados do PostgreSQL/Neon. Nenhuma migration, seed, reset ou SQL destrutivo é executado pelo deploy.

## Correções principais

- Prisma agora é isolado por request no Cloudflare Workers usando AsyncLocalStorage.
- Evita reutilização de sockets/pool `pg` entre contextos diferentes do Worker, causa dos requests que ficavam pendurados em `/api/chapas`, `/api/produtos`, `/api/veiculos` e outras chamadas concorrentes.
- Pool `pg` limitado por request para respeitar o modelo de conexões do Workers.
- Mantidas as correções anteriores de `req.query` read-only no Express 5.
- Mantido rate-limit compatível com `CF-Connecting-IP`.
- Corrigidos tipos de parâmetros de rota do Express 5.
- Corrigidas inferências `never[]` nas rotinas XML/PDF que faziam `pnpm run check` falhar.
- Mantidos `DATABASE_URL` e `JWT_SECRET` como secrets do Worker; não são gravados no repositório.

## Publicação

Na pasta do projeto:

```powershell
pnpm install
pnpm run check
pnpm run deploy
```

Os secrets existentes do Worker `radasa-system` continuam válidos.

Para acompanhar erros após publicar:

```powershell
pnpm exec wrangler tail
```
