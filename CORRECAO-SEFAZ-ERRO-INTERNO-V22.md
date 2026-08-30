# V22 — Correção do erro interno da SEFAZ

Esta versão corrige o retorno genérico "Erro interno do servidor" no módulo Fiscal > Documentos Fiscais.

Principais ajustes:
- A tela de documentos fiscais não exige certificado A1 apenas para abrir/listar.
- A sincronização continua exigindo certificado válido.
- Erro de migration ausente agora informa explicitamente que o banco precisa ser atualizado.
- Binding `SEFAZ_MTLS` ausente no Cloudflare retorna mensagem de configuração, não erro 500 genérico.
- Respostas de espera de 1 hora da SEFAZ retornam 429.
- Falhas de comunicação com a SEFAZ retornam 502 com mensagem útil.

## Publicação

```powershell
cd C:\Users\yago\Downloads\Radasa-System-Cloudflare-v1.4
pnpm install
npx prisma generate
npx prisma migrate deploy
pnpm run check
pnpm run deploy:cloudflare
```

Se o `prisma migrate deploy` não puder ser usado por causa do histórico antigo de migrations, aplique o schema com:

```powershell
npx prisma db push
npx prisma generate
pnpm run deploy:cloudflare
```

Depois abra Fiscal > Documentos Fiscais novamente. Se o certificado mTLS ainda não estiver vinculado ao Worker, o próprio sistema mostrará a mensagem específica de configuração.
