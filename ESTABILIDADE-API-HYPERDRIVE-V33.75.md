# Estabilidade da API — V33.75

Esta versão endurece o fluxo de Acerto de Viagem e reduz rajadas de conexões/requisições.

## Proteções aplicadas

- `SELECT ... FOR UPDATE` serializa gravações concorrentes da mesma viagem no PostgreSQL.
- `editVersion` detecta formulário antigo/stale e devolve conflito 409 em vez de sobrescrever dados recentes.
- Vínculos de abastecimento são sincronizados por diferença; não existe mais `delete all + create all` em cada edição.
- A transação de edição tem timeout de 20s, abaixo do timeout HTTP de 30s do cliente.
- Pool local do `pg` foi reduzido para 1 conexão no fallback direto e 2 via Hyperdrive.
- Prisma Client continua sendo criado por request no Worker, mas agora de forma lazy: rotas que não consultam banco não criam pool.
- `/api/bootstrap` executa no máximo 3 loaders de banco ao mesmo tempo.
- Se o bootstrap falhar, o navegador também limita o fallback para 3 requests simultâneas em vez de disparar todas de uma vez.
- GET pode repetir automaticamente uma única vez em 429/502/503/504. POST/PUT/PATCH/DELETE nunca são repetidos automaticamente.
- Mutações recebem proteção de rajada de 120/min por cliente, sem limitar GETs por esse filtro.
- Cada isolate também processa no máximo 8 mutações simultâneas; até 40 ficam em fila curta antes de receber 503 controlado.
- Cada request ganha `X-Request-Id`; cada mutação ganha `X-Mutation-Id`, ambos aparecem nos logs.
- Erros transitórios de conexão/pool/timeout são devolvidos como HTTP 503 + `Retry-After: 2` em vez de erro 500 genérico.
- Smart Placement foi habilitado no Wrangler.

## Hyperdrive — recomendado para produção

O código já suporta `HYPERDRIVE.connectionString`, mas o binding depende de um ID real da sua conta Cloudflare, portanto não é possível colocá-lo no ZIP sem criar a configuração na sua conta.

Como o sistema precisa de consistência imediatamente após salvar, crie o Hyperdrive com cache de queries desabilitado:

```powershell
npx wrangler hyperdrive create radasa-neon --connection-string="SUA_DATABASE_URL_NEON" --caching-disabled
```

O comando retorna um ID. Depois rode:

```powershell
node scripts/configurar-hyperdrive.mjs SEU_HYPERDRIVE_ID
```

Confira e, se a capacidade do seu plano Neon comportar, limite também as conexões de origem do Hyperdrive (exemplo: 10):

```powershell
npx wrangler hyperdrive get SEU_HYPERDRIVE_ID
npx wrangler hyperdrive update SEU_HYPERDRIVE_ID --origin-connection-limit=10
```

Então publique normalmente:

```powershell
pnpm run deploy:cloudflare
```

Se o binding não estiver configurado, o Worker continua usando `DATABASE_URL`, porém emitirá no log um aviso explícito informando que está em fallback direto.

## Diagnóstico

Nos logs Cloudflare, procure por `requestId` e `mutationId`. Um evento de atualização agora permite diferenciar timeout, conexão indisponível, conflito de edição e request encerrada antes da resposta.
