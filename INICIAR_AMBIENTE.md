# Inicialização local

O projeto já inclui um `.env` para desenvolvimento local.

## 1. Inicie o PostgreSQL

Com Docker Desktop instalado:

```powershell
docker compose up -d
```

Ou use uma instalação local do PostgreSQL com:

- banco: `radasa`
- usuário: `postgres`
- senha: `postgres`
- porta: `5432`

## 2. Prepare o banco

```powershell
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm db:seed
```

## 3. Inicie o sistema

```powershell
pnpm dev
```

Login inicial:

- usuário: `admin`
- senha: `Admin@123456`

> Troque a senha e o `JWT_SECRET` antes de usar em produção.
