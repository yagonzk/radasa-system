# Radasa TMS — Demandas Kanban

## Adicionado

- Nova aba **Demandas** posicionada antes da Dashboard/Visão geral.
- Quadro Kanban inspirado no fluxo do Trello.
- Colunas: Backlog, A fazer, Em andamento, Aguardando e Concluídas.
- Criação rápida de cartões em qualquer coluna.
- Arrastar e soltar cartões entre colunas.
- Título, descrição/anotações, prioridade, responsável, prazo e etiquetas.
- Pesquisa por título, descrição, responsável ou etiqueta.
- Destaque de prazo vencido e prazo do dia.
- Edição por duplo clique ou menu do cartão.
- Exclusão de cartões.
- Persistência completa no PostgreSQL por meio do Prisma.

## Banco de dados

Migration adicionada:

`20260824112500_add_demandas_kanban`

Novos tipos:

- `StatusDemanda`
- `PrioridadeDemanda`

Nova tabela:

- `demandas`

## Publicação

```powershell
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
```

## GitHub

```powershell
git add .
git commit -m "feat: adiciona quadro de demandas kanban"
git push origin main
```
