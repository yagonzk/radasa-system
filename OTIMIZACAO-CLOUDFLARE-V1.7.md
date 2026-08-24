# Radasa Cloudflare v1.7 — otimização

Esta versão mantém o mesmo banco PostgreSQL/Neon e não executa migrations, seed ou reset.

## O que mudou

- GETs de cadastros comuns são agrupados pelo frontend em `/api/bootstrap`, reduzindo várias requests simultâneas para um único Worker request.
- Cache curto no navegador: 15 s para cadastros de apoio e 3 s para dados mais dinâmicos. POST/PUT/DELETE invalidam o cache imediatamente.
- O Prisma continua isolado por request e agora encerra o pool local ao fim da resposta.
- Suporte opcional a Cloudflare Hyperdrive com fallback automático para `DATABASE_URL`.

## Ativar Hyperdrive (recomendado)

1. Crie a configuração usando a MESMA connection string do Neon:

```powershell
pnpm exec wrangler hyperdrive create radasa-neon --connection-string="SUA_DATABASE_URL" --caching-disabled
```

2. O comando retornará um ID. No `wrangler.jsonc`, adicione antes de `vars`:

```jsonc
"hyperdrive": [
  {
    "binding": "HYPERDRIVE",
    "id": "ID_RETORNADO_PELO_CLOUDFLARE"
  }
],
```

3. Rode:

```powershell
pnpm run check
pnpm run deploy
```

O Hyperdrive é criado com query cache desativado de propósito: o sistema precisa refletir gravações imediatamente. Mesmo assim, você ganha o pooling/conexão acelerada do Hyperdrive.

Se o binding não for adicionado, a aplicação continua usando `DATABASE_URL` e funciona como antes.
