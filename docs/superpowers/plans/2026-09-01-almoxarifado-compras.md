# Almoxarifado Compras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar produtos/compras no Almoxarifado com categoria/subcategoria, XML/PDF e reflexo categorizado no DRE.

**Architecture:** Expandir modelos do estoque, manter categorias existentes e adicionar subcategorias vinculadas. O cadastro cria produto + entrada inicial; o DRE lê a categoria do produto nas entradas.

**Tech Stack:** React/TypeScript, Express, Prisma/PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-01-almoxarifado-compras-design.md`

## Global Constraints
- Preservar código automático RAD-xxxxx.
- Cadastro manual continua funcionando.
- Categoria e subcategoria têm cadastro rápido por botão +.
- XML e PDF podem coexistir.

---

### Task 1: Persistência e API
- [ ] Teste RED para campos/subcategoria/anexos e entrada inicial.
- [ ] Expandir Prisma e serviço de estoque.
- [ ] Criar endpoints CRUD de subcategorias.
- [ ] GREEN.

### Task 2: DRE
- [ ] Teste RED exigindo categoria do produto nas entradas.
- [ ] Incluir produto na consulta e agregar pela categoria.
- [ ] GREEN.

### Task 3: Interface Novo Produto
- [ ] Teste RED dos campos e leitura XML.
- [ ] Adicionar quantidade, valor, data, categoria, subcategoria, observação, XML e PDF.
- [ ] Cadastro rápido `+` para categoria e subcategoria.
- [ ] Leitura automática de NF-e e preenchimento dos campos.
- [ ] GREEN.

### Task 4: Verificação e release
- [ ] Rodar regressões existentes.
- [ ] Validar ZIP.
- [ ] Gerar V33.46.
