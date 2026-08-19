# Radasa System v1.53 — Recuperação de senha com Resend

## Alterações

- Substituído o **Cloudflare Email Service pago** pelo envio transacional através da API do **Resend**.
- Removido o binding `send_email` / `EMAIL` do `wrangler.jsonc`.
- A API key do Resend passa a ser lida do secret `RESEND_API_KEY` do Cloudflare Worker.
- O secret nunca é armazenado no frontend ou no `wrangler.jsonc`.
- Envio feito por `POST https://api.resend.com/emails`, sem dependência adicional no projeto.
- Adicionado `Idempotency-Key` derivado do link de recuperação para reduzir risco de e-mail duplicado em retries.
- Mantidos todos os controles da v1.52: token aleatório, SHA-256 no banco, expiração, uso único, rate limit e resposta anti-enumeração.
- Remetente configurável por `EMAIL_FROM_NAME` e `EMAIL_FROM_ADDRESS`.
- Guia de configuração criado em `RESEND-RECUPERACAO-SENHA.md`.

## Banco

Esta versão não cria uma migration adicional. Ela reutiliza `20260818230000_password_reset_email`, criada na v1.52.
Se a v1.52 não chegou a ser publicada/aplicada, execute `pnpm run db:deploy` nesta versão.
