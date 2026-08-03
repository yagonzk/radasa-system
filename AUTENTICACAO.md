# Autenticação do Radasa System

## Recursos implementados

- Cadastro com nome completo, username, e-mail e senha.
- Username e e-mail únicos no PostgreSQL.
- Login usando username **ou** e-mail.
- Senha armazenada somente como hash bcrypt (12 rounds).
- Sessão por JWT enviada no cabeçalho `Authorization: Bearer ...`.
- Recuperação automática da sessão enquanto a aba do navegador permanece aberta.
- Logout pelo perfil da barra lateral.
- Rate limit específico nas rotas de login e cadastro.
- Validação de entrada com Zod.
- Tema claro e escuro na tela de autenticação.

## Rotas

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Cadastro

```json
{
  "name": "Nome do usuário",
  "username": "usuario",
  "email": "usuario@exemplo.com",
  "password": "senha-com-8-ou-mais-caracteres"
}
```

### Login

```json
{
  "identifier": "usuario-ou-email",
  "password": "senha"
}
```

## Banco de dados

Execute as migrations depois de configurar o `.env`:

```bash
pnpm db:generate
pnpm db:deploy
```

Para criar ou atualizar o administrador inicial:

```bash
pnpm db:seed
```

As variáveis usadas pelo seed são `ADMIN_NAME`, `ADMIN_USERNAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

## Observações

Os botões de recuperação de senha e login com Google aparecem conforme o layout de referência, mas estão sinalizados como recursos futuros porque exigem um provedor de e-mail e credenciais OAuth do Google.
