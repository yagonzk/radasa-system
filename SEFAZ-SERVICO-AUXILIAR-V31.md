# SEFAZ automática V31 — serviço auxiliar Node.js

## O que mudou

O Cloudflare Worker não tenta mais apresentar o PFX diretamente à SEFAZ. A rota `/api/sefaz/sincronizar`, o cron de 5 minutos e o botão "Forçar atualização" continuam no Radasa, porém delegam a conexão mTLS a um pequeno serviço Node.js.

O serviço Node lê o certificado A1 e a senha já cadastrados na tabela Empresa, usa `node:https` com `pfx` + `passphrase`, consulta o Ambiente Nacional NF-e e grava os XML/documentos/abastecimentos no mesmo banco Neon.

## Variáveis do serviço auxiliar

- `DATABASE_URL`: mesma URL do Neon usada pelo Radasa.
- `SEFAZ_AGENT_SECRET`: chave aleatória com pelo menos 32 caracteres.
- `PORT`: normalmente fornecida pela hospedagem; padrão 8080.

Endpoint de saúde: `GET /health`.
Endpoint protegido: `POST /sync` com `Authorization: Bearer <SEFAZ_AGENT_SECRET>`.

## Configuração no Cloudflare

Depois que o serviço auxiliar tiver uma URL HTTPS pública, cadastre a URL e o mesmo segredo diretamente no Worker:

```powershell
npx wrangler secret put SEFAZ_AGENT_URL
npx wrangler secret put SEFAZ_AGENT_SECRET
```

No primeiro comando, cole a URL completa do agente (ex.: `https://radasa-sefaz-agent.seudominio.com`). No segundo, cole exatamente o valor configurado como `SEFAZ_AGENT_SECRET` no serviço auxiliar.

## Deploy do serviço auxiliar

A pasta inclui `Dockerfile.sefaz-agent`. Em Railway, Render, Fly.io ou VPS com Docker, use esse Dockerfile e configure as variáveis acima.

Teste antes de publicar o Worker:

```powershell
curl.exe https://SUA-URL-DO-AGENTE/health
```

Resposta esperada:

```json
{"ok":true,"service":"radasa-sefaz-agent","transport":"node:https-pfx"}
```

## Fluxo final

Cloudflare Cron / botão Forçar atualização -> serviço auxiliar Node -> certificado A1 da aba Empresa -> Ambiente Nacional NF-e -> Neon -> Abastecimentos.
