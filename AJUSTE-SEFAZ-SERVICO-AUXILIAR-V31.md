# V31 — SEFAZ via serviço auxiliar Node.js

- O Cloudflare Worker deixou de tentar apresentar o PFX diretamente ao Ambiente Nacional.
- `/api/sefaz/sincronizar`, cron de 5 minutos, Status e Forçar atualização permanecem no Radasa.
- O Worker delega a sincronização para `SEFAZ_AGENT_URL`, autenticado por `SEFAZ_AGENT_SECRET`.
- Novo serviço `sefaz-agent/` executa Node.js completo e usa `node:https` com `pfx` + `passphrase` lidos da aba Empresa.
- O agente usa o mesmo Neon, portanto XML/NSU/abastecimentos aparecem normalmente no Radasa.
- Incluído `Dockerfile.sefaz-agent`, `.env.sefaz-agent.example` e documentação de implantação.
- Erros do agente são mapeados como HTTP 502, preservando a mensagem de diagnóstico.
