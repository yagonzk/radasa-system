# Migração do Radasa System para PostgreSQL

## O que mudou

A interface React, as páginas, o Tailwind CSS, os componentes Radix, as animações e o layout não foram alterados. A mudança foi limitada à camada de dados:

`React -> Axios -> API Express -> Prisma -> PostgreSQL`

O arquivo `client/src/lib/store.ts` mantém os mesmos hooks usados pelas telas (`useMotoristas`, `useManifestos`, etc.), mas agora consulta a API.

## Entidades criadas

- Usuários
- Motoristas
- Chapas
- Clientes
- Produtos
- Locais
- Veículos
- Viagens
- Fechamentos e seus locais/quantidades
- Manifestos e seus produtos

## Migração automática do localStorage

Na primeira inicialização, `client/src/lib/legacyMigration.ts` lê as chaves antigas `gc_*`, envia os registros para `POST /api/migration/local-storage` e registra a conclusão. Os dados antigos não são apagados automaticamente, funcionando como cópia de segurança temporária.

## Segurança

- Senhas com bcrypt (12 rounds)
- JWT
- Zod nas entradas
- Sanitização de caracteres de controle
- Prisma com queries parametrizadas
- Helmet
- CORS por variável de ambiente
- Rate limit
- Tratamento centralizado de erros
- Logs estruturados com Pino e dados sensíveis ocultados
- Papéis `ADMIN` e `USER`

Como o sistema original não possui tela de login e o requisito proíbe mudanças visuais, `AUTH_REQUIRED=false` mantém as rotas operacionais disponíveis. Toda a autenticação está pronta; após criar uma tela de login, defina `AUTH_REQUIRED=true`.

## Instalação

1. Copie `.env.example` para `.env` e troque os valores sensíveis.
2. Crie o banco PostgreSQL indicado em `DATABASE_URL`.
3. Instale as dependências:

```bash
pnpm install
```

4. Gere o Prisma Client e aplique as migrations:

```bash
pnpm db:generate
pnpm db:deploy
```

5. Crie o administrador inicial:

```bash
pnpm db:seed
```

6. Execute em desenvolvimento:

```bash
pnpm dev
```

Frontend: `http://localhost:3000`  
API: `http://localhost:3001/api`

## Rotas

Cada recurso possui `GET /`, `GET /:id`, `POST /`, `PUT /:id` e `DELETE /:id`:

- `/api/motoristas`
- `/api/chapas`
- `/api/clientes`
- `/api/produtos`
- `/api/locais`
- `/api/veiculos`
- `/api/viagens`
- `/api/fechamentos`
- `/api/manifestos`

Autenticação e usuários:

- `POST /api/auth/login`
- `GET /api/auth/me`
- CRUD `/api/usuarios` (ADMIN)

## Observação sobre dependências

O ambiente usado para preparar o projeto não tinha acesso ao registro npm. Por isso as novas dependências não puderam ser baixadas nem validadas contra um PostgreSQL ativo. Execute `pnpm install` na máquina de implantação; esse comando também criará um novo `pnpm-lock.yaml`. A sintaxe dos arquivos TypeScript foi verificada localmente.
