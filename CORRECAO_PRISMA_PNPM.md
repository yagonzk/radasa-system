# Correção Prisma + pnpm 10

## O que foi corrigido

- Configurações do pnpm movidas para `pnpm-workspace.yaml`.
- Patch inválido do Wouter removido da configuração.
- `prisma generate` executado automaticamente no `postinstall` e no `predev`.
- Placeholders inválidos do Umami removidos de `client/index.html`.
- Node 22 indicado em `.nvmrc`.

## Instalação limpa no Windows PowerShell

```powershell
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item pnpm-lock.yaml -Force -ErrorAction SilentlyContinue
pnpm install
pnpm exec prisma generate
pnpm dev
```

Ou execute:

```powershell
./scripts/reset-install.ps1
```

## Observação

O PostgreSQL precisa estar ativo e o arquivo `.env` precisa conter uma `DATABASE_URL` válida.
