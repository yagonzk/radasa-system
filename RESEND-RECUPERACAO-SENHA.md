# Recuperação de senha com Resend — Radasa System

## 1. Criar/entrar na conta Resend

Acesse o painel do Resend e crie uma API key com permissão de envio.

## 2. Verificar o domínio

Adicione `radasa.com.br` em **Domains** no Resend e publique no DNS da Cloudflare os registros apresentados pelo Resend. Aguarde o domínio ficar como **Verified**.

O remetente configurado no projeto é:

`Radasa System <sistema@radasa.com.br>`

## 3. Salvar a API key como Secret no Cloudflare Worker

Na pasta do projeto:

```powershell
pnpm exec wrangler secret put RESEND_API_KEY
```

Cole a chave `re_...` quando o Wrangler solicitar. A chave não deve ser gravada no Git, `.env` de produção ou `wrangler.jsonc`.

Para desenvolvimento local com `wrangler dev`, copie `.dev.vars.example` para `.dev.vars` e preencha `RESEND_API_KEY` apenas nesse arquivo local.

## 4. Banco de dados

A recuperação de senha continua usando a migration criada na v1.52:

`20260818230000_password_reset_email`

Se ela ainda não foi aplicada no Neon:

```powershell
pnpm exec prisma generate
pnpm run db:deploy
```

## 5. Publicar

```powershell
pnpm run check
pnpm run deploy
```

## 6. Testar

1. Abra a tela de login.
2. Clique em **Esqueceu sua senha?**.
3. Informe um usuário/e-mail válido.
4. Confira o e-mail recebido.
5. Abra o link e defina a nova senha.
6. Tente reutilizar o mesmo link: ele deve ser recusado.
