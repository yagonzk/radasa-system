# API Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar edições repetidas de Acerto de Viagem resistentes a concorrência e reduzir picos de carga no Prisma/Neon.

**Architecture:** Serializar mutações da mesma viagem no PostgreSQL, usar versão otimista, sincronizar vínculos diferencialmente e reduzir fan-out de consultas. Complementar com limites de concorrência, diagnóstico por request ID e tratamento controlado de falhas transitórias.

**Tech Stack:** TypeScript, Express, Prisma 6, PostgreSQL/Neon, Cloudflare Workers/Hyperdrive, React, Axios.

**Spec:** `docs/superpowers/specs/2026-09-05-api-stability-design.md`

## Global Constraints
- Não alterar regras de DRE.
- Não repetir automaticamente POST/PUT/PATCH/DELETE.
- Não compartilhar `pg`/Prisma global entre requests no Cloudflare Worker.
- Não hardcodear ID de Hyperdrive.
- Compatibilidade com viagens existentes.

---

### Task 1: Primitivas de concorrência e regressões
**Files:**
- Create: `server/utils/concurrency.ts`
- Create: `server/utils/transient-db-error.ts`
- Create: `scripts/test-api-stability-regression.ts`

**Interfaces:**
- Produces: `diffIds(current, next)`, `assertEditVersion(expected, received)`, `mapWithConcurrency(items, limit, worker)`, `isTransientDatabaseError(error)`.

- [ ] Escrever testes falhando para diff, versão stale, limite de concorrência e classificação de erros transitórios.
- [ ] Executar `pnpm tsx scripts/test-api-stability-regression.ts` e confirmar falha.
- [ ] Implementar os helpers mínimos.
- [ ] Executar o teste novamente e confirmar sucesso.

### Task 2: Concorrência do Acerto de Viagem
**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260905200000_add_viagem_edit_version/migration.sql`
- Modify: `server/services/viagens.service.ts`
- Modify: `client/src/lib/store.ts`
- Modify: `client/src/pages/Viagens.tsx`

**Interfaces:**
- `Viagem.editVersion: number`.
- PUT de viagem aceita `editVersion` opcional e incrementa no servidor.

- [ ] Fazer regressão estática exigir `FOR UPDATE`, update incremental dos vínculos e `editVersion`.
- [ ] Adicionar coluna e migration.
- [ ] Mover leitura/custos/validações para transação após lock da linha.
- [ ] Substituir delete-all/create-all por diff de vínculos.
- [ ] Retornar registro completo na mesma transação e atualizar veículo sem refetch redundante.
- [ ] Enviar `editVersion` no formulário e tipar no store.
- [ ] Rodar regressão.

### Task 3: Proteção de carga, bootstrap e observabilidade
**Files:**
- Modify: `server/lib/prisma.ts`
- Modify: `server/app.ts`
- Modify: `server/middlewares/request-logger.ts`
- Modify: `server/middlewares/error-handler.ts`
- Modify: `server/routes/bootstrap.routes.ts`
- Modify: `client/src/lib/api.ts`
- Modify: `worker/index.ts`
- Create: `ESTABILIDADE-API-HYPERDRIVE-V33.75.md`

**Interfaces:**
- Respostas incluem `X-Request-Id`.
- Falhas transitórias retornam 503 + `Retry-After: 2`.
- GET pode ser repetido uma vez no cliente; mutações nunca.

- [ ] Adicionar request/mutation IDs e burst limiter para métodos de escrita.
- [ ] Reduzir pool direto ao Neon e manter ciclo por request no Worker.
- [ ] Limitar `/bootstrap` a no máximo 3 loaders simultâneos.
- [ ] Classificar erros transitórios e retornar 503 controlado.
- [ ] Implementar retry único somente para GET.
- [ ] Documentar ativação real do Hyperdrive e diagnóstico de fallback.
- [ ] Rodar teste de regressão, `pnpm run check` e `pnpm run build`.
