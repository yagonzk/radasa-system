# Multas e Correção de Movimentação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar Multas da Frota e correção segura de movimentações do Almoxarifado.

**Architecture:** O Almoxarifado reutiliza a movimentação existente e valida o saldo no serviço antes do `update`. Multas usa modelo Prisma próprio, serviço/rotas REST e tela React independente em Frota; a consulta oficial externa fica explicitamente desacoplada até haver credencial SENATRAN/RENAINF.

**Tech Stack:** React 19, TypeScript, Express, Prisma 6, PostgreSQL, Zod, Vite.

**Spec:** `docs/superpowers/specs/2026-09-05-multas-e-correcao-almoxarifado-design.md`

## Global Constraints
- Nunca permitir saldo de estoque negativo após correção.
- Não simular consulta oficial de multas sem integração autorizada.
- Reutilizar cadastro existente de veículos e motoristas.

---

### Task 1: Correção segura de movimentação
**Files:** `server/services/estoque-correction.ts`, `server/services/estoque.service.ts`, `server/routes/estoque.routes.ts`, `server/controllers/estoque.controller.ts`, `client/src/lib/store.ts`, `client/src/pages/Estoque.tsx`, `scripts/test-estoque-correcao-regression.ts`.
- [x] Escrever regressão de saldo e observar falha por helper inexistente.
- [x] Implementar helper e validar regressão.
- [x] Criar PUT de correção e diálogo na tabela de Entrada/Saída.

### Task 2: Modelo e API de Multas
**Files:** `prisma/schema.prisma`, `prisma/migrations/20260905152000_add_multas_frota/migration.sql`, `server/services/multas.service.ts`, `server/services/multas-match.ts`, `server/controllers/multas.controller.ts`, `server/routes/multas.routes.ts`, `server/validators/schemas.ts`, `server/routes/index.ts`.
- [x] Criar modelo e migração.
- [x] Escrever regressão de associação de motorista por placa e observar falha por helper inexistente.
- [x] Implementar associação, CRUD e consulta interna por veículo.

### Task 3: Tela Multas
**Files:** `client/src/pages/Multas.tsx`, `client/src/App.tsx`, `client/src/components/Layout.tsx`, `client/src/lib/store.ts`.
- [x] Adicionar rota/menu em Frota e permissões.
- [x] Adicionar filtros, indicadores, CRUD, vínculo de motorista e documento PDF.
- [x] Exibir limitação da consulta oficial de forma explícita.

### Task 4: Verificação e empacotamento
- [x] Validar sintaxe TypeScript parcial; Prisma completo fica para o ambiente com dependências.
- [x] Rodar regressões puras.
- [x] Criar ZIP V33.68 e verificar integridade.
