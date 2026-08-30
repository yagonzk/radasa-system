# SEFAZ automática V23

- Removido o botão de sincronização manual da tela Documentos Fiscais.
- Removido o card/controle visual de Último NSU.
- Removido o alerta técnico de `SEFAZ_MTLS` da interface do usuário.
- O NSU permanece somente como estado interno da integração, evitando duplicidade.
- NF-e de combustível já continua sendo importada diretamente para Abastecimentos pelo serviço `sefaz-dfe.service.ts`.

## Cloudflare mTLS
O erro do print não é um erro do certificado salvo no cadastro da Empresa: Cloudflare Workers não consegue abrir um PFX do banco com `node:https.Agent`. Em produção, a chamada oficial da SEFAZ exige que o certificado cliente seja cadastrado no Cloudflare e exposto ao Worker como binding `SEFAZ_MTLS`.

Depois de obter o `certificate_id` no Cloudflare, inclua no `wrangler.jsonc`:

```jsonc
"mtls_certificates": [
  { "binding": "SEFAZ_MTLS", "certificate_id": "SEU_CERTIFICATE_ID" }
]
```

Não foi gravado um ID fictício no projeto para não quebrar o deploy.
