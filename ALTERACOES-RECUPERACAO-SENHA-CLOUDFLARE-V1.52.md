# Radasa System v1.52 — Recuperação de senha por e-mail

## Implementado

- Fluxo público **Esqueceu sua senha?** na tela de login.
- Página `/esqueci-senha` para informar usuário ou e-mail.
- Página `/redefinir-senha?token=...` para criação de nova senha.
- Endpoints públicos:
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
- Token criptograficamente aleatório de 32 bytes.
- Apenas SHA-256 do token é persistido no banco; o token original existe somente no link enviado por e-mail.
- Validade padrão de 30 minutos.
- Token de uso único; após a redefinição todos os outros tokens pendentes do usuário são invalidados.
- Ao alterar a senha pelo perfil, links de recuperação pendentes também são invalidados.
- Resposta genérica na solicitação para não informar se um usuário/e-mail existe no sistema.
- Rate limit específico para recuperação: 5 tentativas a cada 15 minutos por origem.
- Registro em `AuditLog` quando a senha é redefinida por e-mail.
- Template HTML + texto simples para o e-mail.

## Cloudflare Email Service

O Worker recebeu o binding `EMAIL` em `wrangler.jsonc`, usando o remetente:

`Radasa System <sistema@radasa.com.br>`

Antes do deploy, o domínio `radasa.com.br` precisa estar habilitado em **Cloudflare > Compute > Email Service > Email Sending**.

Variáveis configuradas no `wrangler.jsonc`:

- `EMAIL_FROM_ADDRESS=sistema@radasa.com.br`
- `PASSWORD_RESET_BASE_URL=https://radasa.com.br`
- `PASSWORD_RESET_TTL_MINUTES=30`

## Banco de dados

Migration adicionada:

`20260818230000_password_reset_email`

Nova tabela:

`password_reset_tokens`

Ela armazena somente o hash do token, usuário, expiração, data de uso e criação.

## Deploy

Esta versão possui migration e exige `pnpm run db:deploy` antes da publicação do Worker.
