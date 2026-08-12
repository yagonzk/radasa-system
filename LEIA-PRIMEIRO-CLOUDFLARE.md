# Radasa System — Cloudflare v1.5

Versão preparada para Cloudflare Workers + Assets, mantendo o PostgreSQL existente.

## O que foi corrigido

- Worker Node/Express em `worker/index.ts` com `nodejs_compat`.
- Express 5 para evitar a cadeia antiga `body-parser/raw-body/iconv-lite` que falhava no Workers.
- Middleware de validação não reatribui `req.query`/`req.params` (somente leitura no Express 5/bridge da Cloudflare).
- Rate limit usa `CF-Connecting-IP`, com fallback seguro para `X-Forwarded-For`/`req.ip`.
- `AUTH_REQUIRED=true` em produção.
- `CLIENT_ORIGIN` configurado para `radasa.com.br` e `www.radasa.com.br`.
- Frontend sempre compila para `dist/public`, servido pelo binding `ASSETS`.
- `pnpm run deploy` agora existe e publica na Cloudflare.
- Logs de erro mostram nome, mensagem, stack e código para diagnóstico.
- Prisma Client, adapter e CLI alinhados em 6.19.3.
- Configurações exclusivas da Vercel removidas desta distribuição.

## Banco: não perde dados

Não há comando automático de seed, reset ou migration no deploy. Use a mesma `DATABASE_URL` do banco PostgreSQL/Neon existente.

Configure os secrets no Worker:

```powershell
pnpm exec wrangler secret put DATABASE_URL
pnpm exec wrangler secret put JWT_SECRET
pnpm exec wrangler secret list
```

## Primeira instalação desta pasta

Como as dependências do Express foram migradas, gere uma instalação limpa:

```powershell
pnpm install
pnpm run check
```

Depois publique:

```powershell
pnpm run deploy
```

Para acompanhar erros em produção:

```powershell
pnpm exec wrangler tail
```

## Importante

Não rode `pnpm run db:seed`, `prisma migrate reset` ou qualquer SQL de limpeza para fazer esta migração de hospedagem.
