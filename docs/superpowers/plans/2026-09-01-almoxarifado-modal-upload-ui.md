# Almoxarifado Modal Upload UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o modal de cadastro de produtos do Almoxarifado conforme o layout aprovado, com formulário amplo e áreas drag-and-drop para XML e PDF.

**Architecture:** Manter toda a lógica atual de cadastro, DRE, categorias, subcategorias e leitura de XML em `Estoque.tsx`. A alteração será concentrada no layout do modal e em um componente local reutilizável de upload por arrastar/soltar, sem alterar contratos de API ou banco.

**Tech Stack:** React, TypeScript, Tailwind CSS, componentes shadcn/ui, lucide-react.

**Spec:** Layout visual aprovado no chat em 2026-09-01.

## Global Constraints
- Não alterar regras de negócio do Almoxarifado/DRE.
- Categoria e Subcategoria continuam com botão `+`.
- XML continua preenchendo automaticamente nome, quantidade, valor unitário e data da compra.
- PDF e XML continuam anexados ao produto.
- Modal precisa ser responsivo e permitir scroll vertical em telas menores.

---

### Task 1: Reorganizar modal e uploads

**Files:**
- Modify: `client/src/pages/Estoque.tsx`
- Test: `scripts/test-almoxarifado-modal-v3347.mjs`

- [ ] Escrever teste estático para o novo layout e drag-and-drop.
- [ ] Rodar o teste e confirmar RED.
- [ ] Implementar modal largo com grids solicitados.
- [ ] Implementar dropzones independentes para XML e PDF.
- [ ] Manter clique para seleção de arquivo.
- [ ] Rodar o teste e confirmar GREEN.
- [ ] Rodar regressões existentes do Almoxarifado.
